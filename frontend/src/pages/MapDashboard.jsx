import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Activity, 
  Clock, 
  MapPin, 
  Layers,
  ShieldCheck,
  Radio,
  LocateFixed,
  Eye
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Fix leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getRiskMeta = (riskLevel, depth) => {
  const d = typeof depth === 'number' ? depth : parseFloat(depth) || 0;
  if (d >= 30 || riskLevel === 'critical' || riskLevel === 'high') {
    return {
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.25)',
      label: 'Critical Hazard (30+cm)',
      pulse: true
    };
  }
  if (d >= 16 || riskLevel === 'moderate') {
    return {
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.25)',
      label: 'Caution Puddle (16-29cm)',
      pulse: false
    };
  }
  return {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.25)',
    label: 'Safe Clearance (<16cm)',
    pulse: false
  };
};

const createCustomIcon = (meta, isCritical = false) => {
  if (isCritical) {
    return new L.DivIcon({
      className: 'beacon-marker-container',
      html: `
        <div class="beacon-wave-2"></div>
        <div class="beacon-wave-1"></div>
        <div class="beacon-core"></div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  }

  return new L.DivIcon({
    className: 'pulse-marker-container',
    html: `
      <div class="pulse-marker-core" style="background-color: ${meta.color};"></div>
      ${meta.pulse ? `<div class="pulse-marker-ring" style="background-color: ${meta.color};"></div>` : ''}
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

// Helper component to auto-fit map bounds when incidents change
function FitBoundsToIncidents({ incidents }) {
  const map = useMap();
  useEffect(() => {
    const valid = incidents.filter(i => i.latitude && i.longitude);
    if (valid.length > 0) {
      const bounds = L.latLngBounds(valid.map(i => [i.latitude, i.longitude]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  }, [incidents, map]);
  return null;
}

export default function MapDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tileMode, setTileMode] = useState('dark'); // 'dark' or 'street'
  const [showMobileLegend, setShowMobileLegend] = useState(false);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/incidents`);
      setIncidents(res.data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setError("Could not load incidents. Backend may be offline.");
    } finally {
      setLoading(false);
    }
  };

  // Metrics summary
  const totalCount = incidents.length;
  const criticalCount = incidents.filter(i => {
    const d = parseFloat(i.estimated_depth_cm) || 0;
    return d >= 30 || i.risk_level === 'critical' || i.risk_level === 'high';
  }).length;
  const cautionCount = incidents.filter(i => {
    const d = parseFloat(i.estimated_depth_cm) || 0;
    return d >= 16 && d < 30;
  }).length;
  const safeCount = incidents.filter(i => {
    const d = parseFloat(i.estimated_depth_cm) || 0;
    return d < 16;
  }).length;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="glass-card" style={{ marginBottom: '14px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '8px', 
                background: 'rgba(16, 185, 129, 0.15)', display: 'flex', 
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Radio size={18} color="#34d399" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                Live GIS Flood Hazard Telemetry
              </h2>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
              Real-time crowdsourced flood depths with automated road-closure risk stratification
            </p>
          </div>

          {/* Quick telemetry stats pill strip - Horizontally scrollable on mobile */}
          <div className="presets-scroll-strip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="map-stat-pill" style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-glass)', color: '#f8fafc', whiteSpace: 'nowrap' }}>
              <span>Total:</span>
              <strong style={{ color: '#38bdf8' }}>{totalCount}</strong>
            </div>

            <div className="map-stat-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', whiteSpace: 'nowrap' }}>
              <ShieldAlert size={14} />
              <span>Critical (30+cm):</span>
              <strong>{criticalCount}</strong>
            </div>

            <div className="map-stat-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#fbbf24', whiteSpace: 'nowrap' }}>
              <AlertTriangle size={14} />
              <span>Caution:</span>
              <strong>{cautionCount}</strong>
            </div>

            <div className="map-stat-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34d399', whiteSpace: 'nowrap' }}>
              <ShieldCheck size={14} />
              <span>Safe:</span>
              <strong>{safeCount}</strong>
            </div>

            <button 
              onClick={fetchIncidents} 
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              title="Refresh telemetry"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>{loading ? '...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Container */}
      <div style={{ 
        position: 'relative', 
        height: 'calc(100vh - 240px)',
        minHeight: '440px',
        borderRadius: 'var(--radius-lg)', 
        overflow: 'hidden',
        border: '2px solid #111111',
        boxShadow: 'var(--shadow-md)'
      }}>
        {/* Mobile floating toggle button */}
        <div className="mobile-map-controls" style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          gap: '8px'
        }}>
          <button
            onClick={() => setShowMobileLegend(!showMobileLegend)}
            className="chip-btn"
            style={{
              background: showMobileLegend ? '#FFCE32' : '#ffffff',
              color: '#111111',
              border: '2px solid #111111',
              boxShadow: '2px 2px 0px #111111',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 800
            }}
          >
            <Layers size={13} />
            <span>{showMobileLegend ? 'Hide Legend' : 'Legend & Feed'}</span>
          </button>

          <button
            onClick={() => setTileMode(tileMode === 'dark' ? 'street' : 'dark')}
            className="chip-btn"
            style={{
              background: '#ffffff',
              color: '#111111',
              border: '2px solid #111111',
              boxShadow: '2px 2px 0px #111111',
              padding: '6px 10px',
              fontSize: '0.78rem',
              fontWeight: 800
            }}
            title="Toggle Map Style"
          >
            <Eye size={12} />
            <span>{tileMode === 'dark' ? 'Dark' : 'Street'}</span>
          </button>
        </div>

        {/* Floating Telemetry Feed Status (Desktop always, Mobile on toggle) */}
        <div 
          className={`map-overlay-panel map-feed-overlay ${showMobileLegend ? 'mobile-visible' : ''}`} 
          style={{ 
            top: 16, 
            left: 16, 
            maxWidth: '280px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="status-pulse-dot"></span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0284c7' }}>
              GIS Command Feed
            </span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
            {lastUpdated ? `Sync: ${lastUpdated}` : 'Connecting...'}
          </div>
          {error && (
            <div style={{ marginTop: '8px', color: '#b91c1c', fontSize: '0.78rem' }}>
              {error}
            </div>
          )}
        </div>

        {/* Floating Hazard Legend (Desktop always, Mobile on toggle) */}
        <div 
          className={`map-overlay-panel map-legend-overlay ${showMobileLegend ? 'mobile-visible' : ''}`} 
          style={{ 
            top: 16, 
            right: 16, 
            width: '260px',
            maxWidth: 'calc(100vw - 32px)'
          }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={15} color="#0284c7" />
                <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f172a' }}>
                  Depth Legend
                </h4>
              </div>
              <button
                onClick={() => setShowMobileLegend(false)}
                style={{ background: 'none', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', color: '#64748b' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 10, height: 10, background: '#10b981', borderRadius: '50%' }}></div>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>Safe Clearance</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#15803d', fontSize: '0.76rem', fontWeight: 700 }}>0 - 15 cm</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: '50%' }}></div>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>Caution Puddle</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#b45309', fontSize: '0.76rem', fontWeight: 700 }}>16 - 29 cm</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 10, height: 10, background: '#ef4444', borderRadius: '50%' }}></div>
                  <span style={{ color: '#0f172a', fontWeight: 700 }}>Stall Risk (Danger)</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#b91c1c', fontSize: '0.76rem', fontWeight: 800 }}>30+ cm</span>
              </div>
            </div>

            <div style={{ marginTop: '10px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1', fontSize: '0.72rem', color: '#64748b' }}>
              Baseline: 65cm car tire diameter
            </div>
          </div>

        {/* Leaflet Map with 100% Free OpenStreetMap Tiles (No API key required) */}
        <MapContainer 
          center={[19.0760, 72.8777]} 
          zoom={12} 
          className={tileMode === 'dark' ? 'map-dark-mode' : ''}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <FitBoundsToIncidents incidents={incidents} />

          {incidents.map((inc) => {
            if (!inc.latitude || !inc.longitude) return null;
            const meta = getRiskMeta(inc.risk_level, inc.estimated_depth_cm);
            const isCritical = inc.estimated_depth_cm >= 30 || inc.sms_alert_sent || inc.risk_level === 'critical';

            return (
              <Marker 
                key={inc.incident_id} 
                position={[inc.latitude, inc.longitude]}
                icon={createCustomIcon(meta, isCritical)}
              >
                <Popup>
                  <div style={{ minWidth: '220px', fontFamily: 'var(--font-sans)', color: '#f8fafc' }}>
                    {/* Status Header Badge */}
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '5px',
                      padding: '3px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.72rem', 
                      fontWeight: 700,
                      background: meta.bg,
                      color: meta.color,
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em'
                    }}>
                      {inc.estimated_depth_cm >= 30 ? <ShieldAlert size={12} /> : <Activity size={12} />}
                      <span>{inc.status_flag || meta.label}</span>
                    </div>

                    {/* Critical Hazard / SMS Dispatched Notification Badge */}
                    {isCritical && (
                      <div style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        border: '2px solid #000000',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '2px 2px 0px #000000'
                      }}>
                        <ShieldAlert size={12} />
                        <span>Automated SMS Alert Dispatched ✓</span>
                      </div>
                    )}

                    {/* Depth Gauge */}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Water Depth:</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: meta.color }}>
                        {inc.estimated_depth_cm} <span style={{ fontSize: '0.85rem' }}>cm</span>
                      </span>
                    </div>

                    {/* Safety Score Meter */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                        <span style={{ color: '#94a3b8' }}>Safety Index:</span>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{inc.safety_score}/100</strong>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.max(0, Math.min(100, inc.safety_score))}%`, 
                          height: '100%', 
                          background: inc.safety_score > 60 ? '#10b981' : (inc.safety_score > 30 ? '#f59e0b' : '#ef4444')
                        }}></div>
                      </div>
                    </div>

                    {/* Metadata & Timestamp */}
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <Clock size={12} />
                      <span>Reported: {new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {inc.confidence && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        Neural Confidence: <strong style={{ color: '#c084fc' }}>{Math.round(parseFloat(inc.confidence) * 100)}%</strong>
                      </div>
                    )}

                    {/* Annotated Visual Proof thumbnail if available */}
                    {inc.annotated_image_url && (
                      <div style={{ marginTop: '10px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                        <img 
                          src={inc.annotated_image_url} 
                          alt="Flood Proof Visual" 
                          style={{ width: '100%', maxHeight: '130px', objectFit: 'cover', display: 'block' }} 
                        />
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

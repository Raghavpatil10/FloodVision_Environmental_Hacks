import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useSearchParams, Link } from 'react-router-dom';
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
  Eye,
  Navigation,
  Compass,
  CheckCircle,
  ExternalLink,
  Car
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

const createUserIcon = () => new L.DivIcon({
  className: 'user-marker-container',
  html: `
    <div class="user-marker-pulse"></div>
    <div class="user-marker-core"></div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const createResolvedIcon = () => new L.DivIcon({
  className: 'pulse-marker-container',
  html: `
    <div class="pulse-marker-core" style="background-color: #10b981; border: 2px solid #ffffff; width: 14px; height: 14px;"></div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11]
});

// Helper component to smoothly center on location or focused incident
function MapController({ userCoords, focusCoords, flyTrigger }) {
  const map = useMap();
  useEffect(() => {
    if (focusCoords && focusCoords.lat && focusCoords.lon) {
      map.flyTo([focusCoords.lat, focusCoords.lon], 15, { animate: true, duration: 1.2 });
    } else if (userCoords && userCoords.lat && userCoords.lon) {
      map.flyTo([userCoords.lat, userCoords.lon], 13, { animate: true, duration: 1.2 });
    }
  }, [userCoords, focusCoords, flyTrigger, map]);
  return null;
}

export default function MapDashboard() {
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const focusLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')) : null;
  const focusLon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')) : null;

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tileMode, setTileMode] = useState('dark'); // 'dark' or 'street'
  const [showResolved, setShowResolved] = useState(false);

  // User Live Geolocation
  const [userCoords, setUserCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [flyTrigger, setFlyTrigger] = useState(0);

  // Focus coordinates if redirected from analyze
  const focusCoords = (focusLat && focusLon) ? { lat: focusLat, lon: focusLon } : null;

  useEffect(() => {
    fetchIncidents();
    // Auto-locate user on mount
    handleLocateMe();
  }, [showResolved]);

  const handleLocateMe = () => {
    if (!('geolocation' in navigator)) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
        setLocating(false);
        setFlyTrigger(prev => prev + 1);
      },
      (err) => {
        console.warn("Geolocation access notice:", err.message);
        setLocating(false);
        // Default to municipal center (e.g. 19.0760, 72.8777) if denied
        if (!userCoords) {
          setUserCoords({ lat: 19.0760, lon: 72.8777 });
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/incidents?include_resolved=${showResolved}`);
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
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  const totalCount = activeIncidents.length;
  const criticalCount = activeIncidents.filter(i => {
    const d = parseFloat(i.estimated_depth_cm) || 0;
    return d >= 30 || i.risk_level === 'critical' || i.risk_level === 'high';
  }).length;
  const cautionCount = activeIncidents.filter(i => {
    const d = parseFloat(i.estimated_depth_cm) || 0;
    return d >= 16 && d < 30;
  }).length;
  const safeCount = activeIncidents.filter(i => {
    const d = parseFloat(i.estimated_depth_cm) || 0;
    return d < 16;
  }).length;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '18px 24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '8px',
                background: '#FFCE32', border: '2px solid #111111', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Radio size={20} color="#111111" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>
                Live GIS Flood Hazard & Telemetry Map
              </h2>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Real-time crowdsourced flood depths with automated road-closure risk stratification and live GPS tracking.
            </p>
          </div>

          {/* Quick telemetry stats pill strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="map-stat-pill" style={{ background: '#f8fafc', border: '2px solid #111111', color: '#0f172a', fontWeight: 800 }}>
              <span>Active:</span>
              <strong style={{ color: '#0284c7' }}>{totalCount}</strong>
            </div>

            <div className="map-stat-pill" style={{ background: '#fee2e2', border: '2px solid #111111', color: '#991b1b', fontWeight: 800 }}>
              <ShieldAlert size={15} color="#ef4444" />
              <span>Critical (30+cm):</span>
              <strong>{criticalCount}</strong>
            </div>

            <div className="map-stat-pill" style={{ background: '#fef3c7', border: '2px solid #111111', color: '#92400e', fontWeight: 800 }}>
              <AlertTriangle size={15} color="#f59e0b" />
              <span>Caution:</span>
              <strong>{cautionCount}</strong>
            </div>

            <button
              onClick={handleLocateMe}
              disabled={locating}
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Center on My GPS Location"
            >
              <Compass size={15} className={locating ? 'animate-spin' : ''} />
              <span>{locating ? 'Locating...' : 'Locate Me'}</span>
            </button>

            <button
              onClick={fetchIncidents}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.84rem' }}
              title="Refresh telemetry"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Container */}
      <div style={{
        position: 'relative',
        height: '75vh',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '3px solid #111111',
        boxShadow: '6px 6px 0px #111111'
      }}>
        {/* Floating Telemetry Feed Status (Top Left) */}
        <div className="map-overlay-panel" style={{ top: 16, left: 16, maxWidth: '300px', background: 'rgba(255, 255, 255, 0.95)', border: '2px solid #111111', color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="status-pulse-dot" style={{ background: '#10b981' }}></span>
            <span style={{ fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a' }}>
              GIS Command Feed
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {lastUpdated ? `Telemetry Synced: ${lastUpdated}` : 'Connecting...'}
          </div>
          {userCoords && (
            <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#0284c7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} />
              <span>GPS: {userCoords.lat.toFixed(4)}, {userCoords.lon.toFixed(4)}</span>
            </div>
          )}
          {focusId && (
            <div style={{ marginTop: '6px', padding: '4px 8px', background: '#fef3c7', border: '1px solid #d97706', borderRadius: '4px', fontSize: '0.74rem', color: '#92400e', fontWeight: 700 }}>
              Inspecting newly reported flood issue #{focusId.slice(0, 8)}
            </div>
          )}
        </div>

        {/* Floating Hazard Legend & Controls (Top Right) */}
        <div className="map-overlay-panel" style={{ top: 16, right: 16, width: '270px', background: 'rgba(255, 255, 255, 0.95)', border: '2px solid #111111', color: '#0f172a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="#0f172a" />
              <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}>
                Depth Legend
              </h4>
            </div>

            {/* Tile Toggle */}
            <button
              onClick={() => setTileMode(tileMode === 'dark' ? 'street' : 'dark')}
              className="chip-btn"
              style={{ padding: '3px 8px', fontSize: '0.74rem', fontWeight: 800, border: '2px solid #111111', background: '#FFCE32' }}
              title="Toggle Map Style"
            >
              <Eye size={12} />
              <span>{tileMode === 'dark' ? 'Dark GIS' : 'Street'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 12, height: 12, background: '#10b981', borderRadius: '50%', border: '2px solid #111111' }}></div>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>Safe Clearance</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#059669', fontSize: '0.78rem', fontWeight: 800 }}>0 - 15 cm</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: '50%', border: '2px solid #111111' }}></div>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>Caution Puddle</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#d97706', fontSize: '0.78rem', fontWeight: 800 }}>16 - 29 cm</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: '50%', border: '2px solid #111111' }}></div>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>Stall Risk (Danger)</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', color: '#dc2626', fontSize: '0.78rem', fontWeight: 800 }}>30+ cm</span>
            </div>

            {/* Resolved Toggle */}
            <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b' }}>Show Cleared/Resolved:</span>
              <button
                onClick={() => setShowResolved(!showResolved)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  border: '1.5px solid #111111',
                  background: showResolved ? '#10b981' : '#e2e8f0',
                  color: showResolved ? '#ffffff' : '#0f172a',
                  cursor: 'pointer'
                }}
              >
                {showResolved ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Floating Quick Action Button (Bottom Right) */}
        <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000, display: 'flex', gap: '10px' }}>
          <button
            onClick={handleLocateMe}
            className="btn btn-primary"
            style={{
              boxShadow: '4px 4px 0px #111111',
              padding: '10px 16px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <LocateFixed size={18} />
            <span>Center on Me</span>
          </button>

          <Link
            to="/routes"
            className="btn btn-emerald"
            style={{
              boxShadow: '4px 4px 0px #111111',
              padding: '10px 16px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Navigation size={18} />
            <span>Route Planner</span>
          </Link>
        </div>

        {/* Leaflet Map with OpenStreetMap Tiles */}
        <MapContainer
          center={focusCoords ? [focusCoords.lat, focusCoords.lon] : (userCoords ? [userCoords.lat, userCoords.lon] : [19.0760, 72.8777])}
          zoom={focusCoords ? 15 : 13}
          className={tileMode === 'dark' ? 'map-dark-mode' : ''}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapController userCoords={userCoords} focusCoords={focusCoords} flyTrigger={flyTrigger} />

          {/* User Live GPS Marker */}
          {userCoords && (
            <Marker position={[userCoords.lat, userCoords.lon]} icon={createUserIcon()}>
              <Popup>
                <div style={{ minWidth: '180px', fontFamily: 'var(--font-sans)', color: '#0f172a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#0284c7', marginBottom: '4px' }}>
                    <MapPin size={16} />
                    <span>Your Current Location</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Lat: {userCoords.lat.toFixed(4)}, Lon: {userCoords.lon.toFixed(4)}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <Link
                      to={`/routes?originLat=${userCoords.lat}&originLon=${userCoords.lon}`}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'inline-block' }}
                    >
                      Route from Here →
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Incident Markers */}
          {incidents.map((inc) => {
            if (!inc.latitude || !inc.longitude) return null;
            const isResolved = inc.status === 'resolved';
            const meta = getRiskMeta(inc.risk_level, inc.estimated_depth_cm);
            const isCritical = (inc.estimated_depth_cm >= 30 || inc.sms_alert_sent || inc.risk_level === 'critical') && !isResolved;

            return (
              <Marker
                key={inc.incident_id}
                position={[inc.latitude, inc.longitude]}
                icon={isResolved ? createResolvedIcon() : createCustomIcon(meta, isCritical)}
              >
                <Popup>
                  <div style={{ minWidth: '240px', fontFamily: 'var(--font-sans)', color: '#0f172a' }}>
                    {/* Status Header Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        background: isResolved ? '#d1fae5' : meta.bg,
                        color: isResolved ? '#065f46' : meta.color,
                        textTransform: 'uppercase',
                        border: '1.5px solid #111111'
                      }}>
                        {isResolved ? (
                          <>
                            <CheckCircle2 size={13} color="#059669" />
                            <span>RESOLVED / ROAD CLEARED</span>
                          </>
                        ) : (
                          <>
                            {inc.estimated_depth_cm >= 30 ? <ShieldAlert size={13} /> : <Activity size={13} />}
                            <span>{inc.status_flag || meta.label}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Critical Hazard Alert Badge */}
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
                        gap: '6px'
                      }}>
                        <ShieldAlert size={14} />
                        <span>Emergency Alert Active</span>
                      </div>
                    )}

                    {/* Depth Gauge */}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Water Depth:</span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: isResolved ? '#64748b' : meta.color }}>
                        {inc.estimated_depth_cm} <span style={{ fontSize: '0.85rem' }}>cm</span>
                      </span>
                    </div>

                    {/* Safety Score Meter */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                        <span style={{ color: '#64748b', fontWeight: 700 }}>Passage Safety:</span>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: '#0284c7' }}>{inc.safety_score}/100</strong>
                      </div>
                      <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.max(0, Math.min(100, inc.safety_score))}%`,
                          height: '100%',
                          background: isResolved ? '#10b981' : (inc.safety_score > 60 ? '#10b981' : (inc.safety_score > 30 ? '#f59e0b' : '#ef4444'))
                        }}></div>
                      </div>
                    </div>

                    {/* Metadata & Timestamp */}
                    <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <Clock size={12} />
                      <span>Logged: {inc.reported_at ? new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</span>
                    </div>

                    {inc.confidence && (
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                        YOLOv8 Accuracy: <strong style={{ color: '#7c3aed' }}>{Math.round(parseFloat(inc.confidence) * 100)}%</strong>
                      </div>
                    )}

                    {/* Visual Proof thumbnail if available */}
                    {(inc.annotated_image_url || inc.raw_image_url) && (
                      <div style={{ marginTop: '10px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #111111' }}>
                        <img
                          src={inc.annotated_image_url || inc.raw_image_url}
                          alt="Flood Proof Visual"
                          style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                    )}

                    {/* Action button: Avoid hazard in Route Planner */}
                    {!isResolved && (
                      <div style={{ marginTop: '12px' }}>
                        <Link
                          to={`/routes?destLat=${inc.latitude}&destLon=${inc.longitude}&hazardId=${inc.incident_id}`}
                          className="btn btn-emerald"
                          style={{
                            width: '100%',
                            fontSize: '0.78rem',
                            padding: '6px 10px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '6px',
                            textDecoration: 'none'
                          }}
                        >
                          <Navigation size={13} />
                          <span>Plan Detour Around Flood</span>
                        </Link>
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

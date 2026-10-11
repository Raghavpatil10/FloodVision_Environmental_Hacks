import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import { getUserLocation } from '../utils/geoUtils';
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
  Compass
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

const createCustomIcon = (meta, isCritical = false, isFocused = false) => {
  if (isFocused) {
    return new L.DivIcon({
      className: 'focused-marker-container',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 26px; height: 26px; border-radius: 50%; background: #ef4444; border: 3px solid #ffffff; box-shadow: 0 0 12px #ef4444; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 800;">!</div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22]
    });
  }

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

// Distinct User Location Marker Pin
const createUserPinIcon = () => {
  return new L.DivIcon({
    className: 'user-pin-marker',
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(37, 99, 235, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 20px; height: 20px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(37, 99, 235, 0.9);"></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Smart Map View Controller: Handles flyTo on focus or user location
function MapController({ focusCoords, userLocation, incidents, reCenterTrigger }) {
  const map = useMap();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (focusCoords && focusCoords.lat && focusCoords.lon) {
      // Prioritize focusing on the newly uploaded incident!
      map.flyTo([focusCoords.lat, focusCoords.lon], 16, { animate: true, duration: 1.2 });
      hasInitializedRef.current = true;
    } else if (userLocation && userLocation.lat && userLocation.lon && !hasInitializedRef.current) {
      // Center on user's active area on load
      map.setView([userLocation.lat, userLocation.lon], 13);
      hasInitializedRef.current = true;
    }
  }, [focusCoords, userLocation, map]);

  // Triggered on "Locate Me" button click
  useEffect(() => {
    if (reCenterTrigger && userLocation && userLocation.lat && userLocation.lon) {
      map.flyTo([userLocation.lat, userLocation.lon], 14, { animate: true, duration: 1.0 });
    }
  }, [reCenterTrigger, userLocation, map]);

  return null;
}

export default function MapDashboard() {
  const routerLocation = useLocation();
  const [searchParams] = useSearchParams();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tileMode, setTileMode] = useState('street'); // default to high-contrast street
  const [showMobileLegend, setShowMobileLegend] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [reCenterCounter, setReCenterCounter] = useState(0);

  const markerRefs = useRef({});

  // Parse focus coordinates from URL query or location.state
  const queryLat = searchParams.get('lat');
  const queryLon = searchParams.get('lon');
  const queryIncidentId = searchParams.get('incident_id');

  const focusCoords = (queryLat && queryLon) ? {
    lat: parseFloat(queryLat),
    lon: parseFloat(queryLon),
    incident_id: queryIncidentId
  } : (routerLocation.state?.focusLat && routerLocation.state?.focusLon ? {
    lat: routerLocation.state.focusLat,
    lon: routerLocation.state.focusLon,
    incident_id: routerLocation.state.incidentId
  } : null);

  useEffect(() => {
    fetchIncidents();
    detectUserArea();
  }, []);

  const detectUserArea = async () => {
    setLocatingUser(true);
    try {
      const loc = await getUserLocation();
      setUserLocation(loc);
    } catch (e) {
      console.warn("User location detection error:", e);
    } finally {
      setLocatingUser(false);
    }
  };

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

  // Automatically open popup if targeted by focusCoords
  useEffect(() => {
    if (focusCoords && incidents.length > 0) {
      const matched = incidents.find(i => 
        (focusCoords.incident_id && i.incident_id === focusCoords.incident_id) ||
        (Math.abs(i.latitude - focusCoords.lat) < 0.0005 && Math.abs(i.longitude - focusCoords.lon) < 0.0005)
      );
      if (matched && markerRefs.current[matched.incident_id]) {
        setTimeout(() => {
          markerRefs.current[matched.incident_id].openPopup();
        }, 1200);
      }
    }
  }, [focusCoords, incidents]);

  const handleLocateMeClick = () => {
    if (userLocation) {
      setReCenterCounter(prev => prev + 1);
    } else {
      detectUserArea();
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

  const defaultCenter = focusCoords 
    ? [focusCoords.lat, focusCoords.lon] 
    : (userLocation ? [userLocation.lat, userLocation.lon] : [21.1463, 79.0849]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="glass-card" style={{ marginBottom: '14px', padding: '16px 20px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '8px', 
                background: '#FFCE32', border: '2px solid #111111', display: 'flex', 
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Radio size={18} color="#111111" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#111111' }}>
                Live GIS Flood Hazard Telemetry
              </h2>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
              Real-time crowdsourced flood depths with automated road-closure risk stratification
            </p>
          </div>

          {/* User Location Badge & Action Buttons */}
          <div className="presets-scroll-strip" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userLocation && (
              <div style={{
                background: '#eff6ff',
                border: '2px solid #111111',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '2px 2px 0px #111111'
              }}>
                <LocateFixed size={14} color="#2563eb" />
                <span>Area: <strong>{userLocation.city || 'Your Region'}</strong>{userLocation.region ? `, ${userLocation.region}` : ''}</span>
              </div>
            )}

            <button
              onClick={handleLocateMeClick}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              title="Pan to My Current Location"
            >
              <Compass size={14} className={locatingUser ? 'animate-spin' : ''} />
              <span>{locatingUser ? 'Locating...' : 'Locate My Area'}</span>
            </button>

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

        {/* Focus Banner (if user navigated from photo upload) */}
        {focusCoords && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: '#fef3c7',
            border: '2px solid #111111',
            borderRadius: '6px',
            fontSize: '0.86rem',
            fontWeight: 700,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} color="#b45309" />
              <span>📍 Focused on Uploaded Image Coordinates: Lat {focusCoords.lat.toFixed(5)}, Lon {focusCoords.lon.toFixed(5)}</span>
            </div>
            <span style={{ fontSize: '0.78rem', background: '#ffffff', border: '1px solid #111111', padding: '2px 8px', borderRadius: '4px' }}>
              Pinpoint Active ✓
            </span>
          </div>
        )}
      </div>

      {/* Main Map Container */}
      <div style={{ 
        position: 'relative', 
        height: 'calc(100vh - 240px)',
        minHeight: '480px',
        borderRadius: 'var(--radius-lg)', 
        overflow: 'hidden',
        border: '3px solid #111111',
        boxShadow: 'var(--shadow-md)'
      }}>
        {/* Floating Map Controls */}
        <div className="mobile-map-controls" style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
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
            <span>{showMobileLegend ? 'Hide Legend' : 'Legend'}</span>
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

        {/* Floating Telemetry Feed Status */}
        <div 
          className={`map-overlay-panel map-feed-overlay ${showMobileLegend ? 'mobile-visible' : ''}`} 
          style={{ 
            top: 16, 
            left: 16, 
            maxWidth: '280px',
            background: '#ffffff',
            border: '2px solid #111111',
            boxShadow: '4px 4px 0px #111111',
            padding: '12px 14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="status-pulse-dot"></span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0284c7' }}>
              GIS Telemetry Feed
            </span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
            {lastUpdated ? `Active Sync: ${lastUpdated}` : 'Connecting...'}
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#111111' }}>
            Active Reports: <strong style={{ color: '#ef4444' }}>{criticalCount} Critical</strong> • {totalCount} Total
          </div>
        </div>

        {/* Floating Hazard Legend */}
        <div 
          className={`map-overlay-panel map-legend-overlay ${showMobileLegend ? 'mobile-visible' : ''}`} 
          style={{ 
            top: 16, 
            right: 16, 
            width: '260px',
            maxWidth: 'calc(100vw - 32px)',
            background: '#ffffff',
            border: '2px solid #111111',
            boxShadow: '4px 4px 0px #111111',
            padding: '14px'
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
              <div style={{ width: 10, height: 10, background: '#2563eb', borderRadius: '50%' }}></div>
              <span style={{ color: '#1e40af', fontWeight: 700 }}>Your Detected Location</span>
            </div>
          </div>
        </div>

        {/* Leaflet Map with OpenStreetMap */}
        <MapContainer 
          center={defaultCenter} 
          zoom={focusCoords ? 16 : 13} 
          className={tileMode === 'dark' ? 'map-dark-mode' : ''}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapController 
            focusCoords={focusCoords} 
            userLocation={userLocation} 
            incidents={incidents} 
            reCenterTrigger={reCenterCounter} 
          />

          {/* User Current Location Marker */}
          {userLocation && userLocation.lat && userLocation.lon && (
            <Marker 
              position={[userLocation.lat, userLocation.lon]}
              icon={createUserPinIcon()}
            >
              <Popup>
                <div style={{ minWidth: '180px', fontFamily: 'var(--font-sans)', color: '#0f172a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.9rem', color: '#1e40af', marginBottom: '4px' }}>
                    <LocateFixed size={16} />
                    <span>You Are Here</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '6px' }}>
                    {userLocation.city || 'Detected Area'}{userLocation.region ? `, ${userLocation.region}` : ''}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    Coordinates: {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Incident Pins */}
          {incidents.map((inc) => {
            if (!inc.latitude || !inc.longitude) return null;
            const isThisFocused = focusCoords && (
              (focusCoords.incident_id && inc.incident_id === focusCoords.incident_id) ||
              (Math.abs(inc.latitude - focusCoords.lat) < 0.0005 && Math.abs(inc.longitude - focusCoords.lon) < 0.0005)
            );
            const meta = getRiskMeta(inc.risk_level, inc.estimated_depth_cm);
            const isCritical = inc.estimated_depth_cm >= 30 || inc.sms_alert_sent || inc.risk_level === 'critical';

            return (
              <Marker 
                key={inc.incident_id} 
                position={[inc.latitude, inc.longitude]}
                icon={createCustomIcon(meta, isCritical, isThisFocused)}
                ref={(el) => {
                  if (el) markerRefs.current[inc.incident_id] = el;
                }}
              >
                <Popup>
                  <div style={{ minWidth: '220px', fontFamily: 'var(--font-sans)', color: '#0f172a' }}>
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

                    {isThisFocused && (
                      <div style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #b45309',
                        borderRadius: '4px',
                        padding: '3px 6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        marginBottom: '6px'
                      }}>
                        🎯 Just Submitted Telemetry Pinpoint
                      </div>
                    )}

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
                      <span style={{ fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', fontWeight: 600 }}>Water Depth:</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: meta.color }}>
                        {inc.estimated_depth_cm} <span style={{ fontSize: '0.85rem' }}>cm</span>
                      </span>
                    </div>

                    {/* Safety Score Meter */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                        <span style={{ color: '#475569' }}>Safety Index:</span>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: '#0284c7' }}>{inc.safety_score}/100</strong>
                      </div>
                      <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.max(0, Math.min(100, inc.safety_score))}%`, 
                          height: '100%', 
                          background: inc.safety_score > 60 ? '#10b981' : (inc.safety_score > 30 ? '#f59e0b' : '#ef4444')
                        }}></div>
                      </div>
                    </div>

                    {/* Metadata & Timestamp */}
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <Clock size={12} />
                      <span>Reported: {new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Coordinates */}
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      Lat: {inc.latitude.toFixed(4)}, Lon: {inc.longitude.toFixed(4)}
                    </div>

                    {/* Annotated Visual Proof thumbnail if available */}
                    {inc.annotated_image_url && (
                      <div style={{ marginTop: '10px', borderRadius: '6px', overflow: 'hidden', border: '2px solid #111111' }}>
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

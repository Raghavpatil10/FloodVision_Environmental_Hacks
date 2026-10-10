import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import BackButton from '../components/BackButton';
import { 
  Navigation, 
  MapPin, 
  Flag, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  Layers, 
  Compass, 
  Sparkles,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  Eye,
  Car,
  Zap,
  TrendingUp,
  AlertCircle,
  Activity,
  Layers3
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom animated marker pins
const createPinIcon = (color, label) => {
  return new L.DivIcon({
    className: 'pulse-marker-container',
    html: `
      <div class="pulse-marker-core" style="background-color: ${color}; width: 16px; height: 16px;"></div>
      <div class="pulse-marker-ring" style="background-color: ${color}; width: 28px; height: 28px;"></div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

const startIcon = createPinIcon('#10b981', 'Origin');
const destIcon = createPinIcon('#06b6d4', 'Destination');

const bottleneckIcon = new L.DivIcon({
  className: 'bottleneck-marker-container',
  html: `
    <div style="background-color: #ef4444; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 10px #ef4444; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 11px; font-weight: 900;">!</div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11]
});

// Robust coordinate parser: handles degrees, cardinal (N/S/E/W), commas, spaces
const parseCoordinates = (str) => {
  if (!str || typeof str !== 'string') return null;
  const cleaned = str.trim();
  const pattern = /([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSns])?[\s,;]+([+-]?\d+(?:\.\d+)?)\s*°?\s*([EWew])?/;
  const match = cleaned.match(pattern);
  if (match) {
    let lat = parseFloat(match[1]);
    if (match[2] && match[2].toUpperCase() === 'S') lat = -lat;
    let lon = parseFloat(match[3]);
    if (match[4] && match[4].toUpperCase() === 'W') lon = -lon;
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon };
    }
  }
  const parts = cleaned.split(',');
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].replace(/[^\d.-]/g, ''));
    const lon = parseFloat(parts[1].replace(/[^\d.-]/g, ''));
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon };
    }
  }
  return null;
};

// Auto-Fit Map Bounds Helper Component
function AutoFitRouteBounds({ origin, destination, points }) {
  const map = useMap();

  useEffect(() => {
    const coordsList = [];
    if (points && points.length > 0) {
      points.forEach(p => coordsList.push([p.lat, p.lon]));
    } else {
      if (origin) coordsList.push([origin.lat, origin.lon]);
      if (destination) coordsList.push([destination.lat, destination.lon]);
    }

    if (coordsList.length >= 2) {
      const bounds = L.latLngBounds(coordsList);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (coordsList.length === 1) {
      map.setView(coordsList[0], 13);
    }
  }, [origin, destination, points, map]);

  return null;
}

const PRESETS = [
  {
    name: 'Nagpur Route (Active Test)',
    desc: 'Route from screenshot (21.1298° N, 79.0752° E)',
    origin: '21.1298° N, 79.0752° E',
    destination: '21.1390° N, 79.0631° E'
  },
  {
    name: 'Bandra → BKC Corridor',
    desc: 'Mumbai low-lying flood bypass',
    origin: '19.0596, 72.8295',
    destination: '19.0664, 72.8687'
  },
  {
    name: 'Dadar → Lower Parel',
    desc: 'Hindmata underpass bypass',
    origin: '19.0178, 72.8478',
    destination: '18.9950, 72.8260'
  }
];

export default function RoutePlanner() {
  const [origin, setOrigin] = useState('21.1298° N, 79.0752° E');
  const [destination, setDestination] = useState('21.1390° N, 79.0631° E');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tileMode, setTileMode] = useState('dark');

  // Traffic Consideration Controls
  const [considerTraffic, setConsiderTraffic] = useState(true);
  const [trafficMode, setTrafficMode] = useState('live'); // 'live', 'rush_hour', 'free_flow'
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0); // 0 = recommended, 1..n = alternatives
  const [mapLayerMode, setMapLayerMode] = useState('traffic'); // 'traffic' or 'safety'

  const origCoords = parseCoordinates(origin);
  const destCoords = parseCoordinates(destination);

  const handlePlanRoute = async (e) => {
    if (e) e.preventDefault();
    if (!origCoords || !destCoords) {
      setError("Please enter valid coordinates (e.g. '21.1298° N, 79.0752° E' or '19.0596, 72.8295').");
      return;
    }

    setLoading(true);
    setError(null);
    setRouteData(null);
    setSelectedRouteIndex(0);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/routes/plan`, {
        origin: origCoords,
        destination: destCoords,
        consider_traffic: considerTraffic,
        traffic_mode: trafficMode
      });
      setRouteData(res.data);
      setSelectedRouteIndex(0);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not plan route.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
    setRouteData(null);
  };

  const handleApplyPreset = (p) => {
    setOrigin(p.origin);
    setDestination(p.destination);
    setError(null);
    setRouteData(null);
  };

  // Resolve currently inspected route
  const getActiveRoute = () => {
    if (!routeData) return null;
    if (selectedRouteIndex === 0) return routeData.recommended_route;
    if (routeData.alternative_routes && routeData.alternative_routes[selectedRouteIndex - 1]) {
      return routeData.alternative_routes[selectedRouteIndex - 1];
    }
    return routeData.recommended_route;
  };

  const activeRoute = getActiveRoute();

  // Determine polyline positions
  const getPolylinePositions = () => {
    if (!activeRoute) return [];
    if (activeRoute.coordinates && activeRoute.coordinates.length > 0) {
      return activeRoute.coordinates.map(c => [c.lat, c.lon]);
    }
    if (routeData.origin && routeData.destination) {
      return [
        [routeData.origin.lat, routeData.origin.lon],
        [routeData.destination.lat, routeData.destination.lon]
      ];
    }
    return [];
  };

  const polylinePositions = getPolylinePositions();
  const routeScore = activeRoute?.overall_safety_score ?? 100;
  const polylineColor = routeScore < 50 ? '#ef4444' : (routeScore < 75 ? '#f59e0b' : '#10b981');

  // Traffic congestion badge helper
  const getTrafficCongestionMeta = (level) => {
    switch (level) {
      case 'severe':
        return { label: 'Severe Gridlock', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)' };
      case 'heavy':
        return { label: 'Heavy Traffic', color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', border: 'rgba(249, 115, 22, 0.4)' };
      case 'moderate':
        return { label: 'Moderate Traffic', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.4)' };
      case 'free_flow':
      default:
        return { label: 'Free Flow', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', border: 'rgba(16, 185, 129, 0.4)' };
    }
  };

  // Default initial map center
  const initialCenter = origCoords ? [origCoords.lat, origCoords.lon] : [21.1298, 79.0752];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Top Left Theme-Consistent Back Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
        <BackButton to="/" label="Back to Home" />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Column: Route Controller Panel */}
        <div className="glass-card" style={{ padding: '24px', color: '#f8fafc' }}>
          {/* Header */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '8px', 
                background: 'rgba(124, 58, 237, 0.2)', display: 'flex', 
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Compass size={22} color="#c084fc" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc' }}>
                Safe Route Planner
              </h2>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Calculates vehicle-safe navigation weighted against real-time waterlogging depths and live traffic congestion.
            </p>
          </div>

          {/* Quick Demo Presets */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.78rem', 
              fontWeight: 600, 
              color: '#94a3b8', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              marginBottom: '8px'
            }}>
              <Sparkles size={14} color="#38bdf8" />
              <span>Quick Demo Scenarios</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="chip-btn"
                  title={p.desc}
                >
                  <MapPin size={12} color="#38bdf8" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handlePlanRoute}>
            <div className="form-group">
              <label className="form-label" style={{ color: '#94a3b8' }}>
                <MapPin size={14} color="#10b981" />
                <span>Origin (Lat, Lon):</span>
              </label>
              <input
                className="form-input font-mono"
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                placeholder="e.g. 21.1298° N, 79.0752° E"
              />
              <div className="coord-feedback">
                {origCoords ? (
                  <span className="coord-valid">
                    ✓ Parsed: {origCoords.lat.toFixed(4)}, {origCoords.lon.toFixed(4)}
                  </span>
                ) : (
                  <span className="coord-hint">
                    Enter coordinates (e.g. 21.1298° N, 79.0752° E)
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 12px 0' }}>
              <button
                type="button"
                onClick={handleSwap}
                className="chip-btn"
                style={{ padding: '4px 12px', fontSize: '0.76rem' }}
                title="Swap Origin and Destination"
              >
                <ArrowUpDown size={12} />
                <span>Swap Directions</span>
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#94a3b8' }}>
                <Flag size={14} color="#06b6d4" />
                <span>Destination (Lat, Lon):</span>
              </label>
              <input
                className="form-input font-mono"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="e.g. 21.1390° N, 79.0631° E"
              />
              <div className="coord-feedback">
                {destCoords ? (
                  <span className="coord-valid">
                    ✓ Parsed: {destCoords.lat.toFixed(4)}, {destCoords.lon.toFixed(4)}
                  </span>
                ) : (
                  <span className="coord-hint">
                    Enter coordinates (e.g. 21.1390° N, 79.0631° E)
                  </span>
                )}
              </div>
            </div>

            {/* Traffic Consideration Controls */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1.5px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={considerTraffic}
                    onChange={e => setConsiderTraffic(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Car size={15} color="#38bdf8" />
                    Factor Live Traffic & Delays
                  </span>
                </label>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: considerTraffic ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                  color: considerTraffic ? '#34d399' : '#94a3b8',
                  border: `1px solid ${considerTraffic ? 'rgba(16, 185, 129, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`
                }}>
                  {considerTraffic ? 'ACTIVE' : 'OFF'}
                </span>
              </div>

              {considerTraffic && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {[
                    { id: 'live', label: 'Live Diurnal' },
                    { id: 'rush_hour', label: 'Peak Rush Hour' },
                    { id: 'free_flow', label: 'Free Flow' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTrafficMode(m.id)}
                      className="chip-btn"
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.74rem',
                        textAlign: 'center',
                        justifyContent: 'center',
                        background: trafficMode === m.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                        color: trafficMode === m.id ? '#0f172a' : '#94a3b8',
                        fontWeight: trafficMode === m.id ? 800 : 600,
                        borderColor: trafficMode === m.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !origCoords || !destCoords}
              className="btn btn-purple"
              style={{ width: '100%', padding: '13px', fontSize: '1rem', marginTop: '4px' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Evaluating Flood & Traffic Corridors...</span>
                </>
              ) : (
                <>
                  <Navigation size={16} />
                  <span>Find Safe Route</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Route Results */}
          {routeData && activeRoute && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedRouteIndex === 0 ? 'Optimal Safe Navigation' : `Inspecting Option ${selectedRouteIndex}`}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {activeRoute.traffic_congestion_level && (
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: getTrafficCongestionMeta(activeRoute.traffic_congestion_level).bg,
                      color: getTrafficCongestionMeta(activeRoute.traffic_congestion_level).color,
                      border: `1px solid ${getTrafficCongestionMeta(activeRoute.traffic_congestion_level).border}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Car size={12} />
                      <span>{getTrafficCongestionMeta(activeRoute.traffic_congestion_level).label}</span>
                    </span>
                  )}
                  <span className={`badge ${routeScore < 50 ? 'badge-danger' : 'badge-safe'}`}>
                    <ShieldCheck size={14} />
                    <span>{routeScore < 50 ? 'High Risk' : 'Recommended'}</span>
                  </span>
                </div>
              </div>

              {/* Active Route Inspection Card */}
              <div className={`route-card ${routeScore < 50 ? 'route-card-danger' : 'route-card-safe'}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.70rem', color: '#94a3b8', textTransform: 'uppercase' }}>Distance</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                      {(activeRoute.total_distance_m / 1000).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>km</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.70rem', color: '#94a3b8', textTransform: 'uppercase' }}>Est. Travel</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
                      {Math.max(1, Math.round(activeRoute.total_duration_s / 60))} <span style={{ fontSize: '0.75rem' }}>min</span>
                    </div>
                    {activeRoute.traffic_delay_s > 0 && (
                      <div style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>
                        +{Math.round(activeRoute.traffic_delay_s / 60)}m delay
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.70rem', color: '#94a3b8', textTransform: 'uppercase' }}>Flood Safety</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: polylineColor }}>
                      {activeRoute.overall_safety_score} <span style={{ fontSize: '0.75rem' }}>/100</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.70rem', color: '#94a3b8', textTransform: 'uppercase' }}>Viability</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                      {activeRoute.composite_score ?? activeRoute.overall_safety_score} <span style={{ fontSize: '0.75rem' }}>/100</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.88rem',
                  color: '#f8fafc',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingTop: '10px',
                  lineHeight: 1.45
                }}>
                  <strong style={{ color: polylineColor }}>Navigation Advice: </strong>
                  {activeRoute.recommendation_reason || "Route evaluated across live flood hazards and corridor traffic."}
                </div>

                {/* Localized Bottlenecks strip */}
                {activeRoute.traffic_bottlenecks && activeRoute.traffic_bottlenecks.length > 0 && (
                  <div style={{
                    marginTop: '10px',
                    padding: '8px 10px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.78rem'
                  }}>
                    <div style={{ fontWeight: 800, color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <AlertTriangle size={13} />
                      <span>Traffic Friction & Bottlenecks Detected:</span>
                    </div>
                    {activeRoute.traffic_bottlenecks.map((b, bIdx) => (
                      <div key={bIdx} style={{ color: '#fca5a5', lineHeight: 1.4 }}>
                        • {b.description} (+{Math.round(b.delay_s / 60)} min delay)
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Alternative Routes Comparison */}
              {routeData.alternative_routes && routeData.alternative_routes.length > 0 && (
                <div style={{ marginTop: '18px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Alternative Corridor Options
                  </div>

                  {/* Recommended Option Tab Button */}
                  <div 
                    onClick={() => setSelectedRouteIndex(0)}
                    className="route-card route-card-alt"
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      border: selectedRouteIndex === 0 ? '2px solid #38bdf8' : '1px solid var(--border-glass)',
                      marginBottom: '8px',
                      background: selectedRouteIndex === 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc' }}>
                          Primary Recommended Route
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                          {(routeData.recommended_route.total_distance_m / 1000).toFixed(2)} km • {Math.round(routeData.recommended_route.total_duration_s / 60)} min in traffic
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '10px',
                          color: '#34d399',
                          background: 'rgba(16, 185, 129, 0.15)'
                        }}>
                          Score: {routeData.recommended_route.composite_score ?? 100}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alternative Options */}
                  {routeData.alternative_routes.map((alt, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedRouteIndex(idx + 1)}
                      className="route-card route-card-alt" 
                      style={{ 
                        padding: '10px 14px',
                        cursor: 'pointer',
                        border: selectedRouteIndex === (idx + 1) ? '2px solid #38bdf8' : '1px solid var(--border-glass)',
                        marginBottom: '8px',
                        background: selectedRouteIndex === (idx + 1) ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#f8fafc' }}>Option {idx + 1} (Alternative)</div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                            {(alt.total_distance_m / 1000).toFixed(2)} km • {Math.round(alt.total_duration_s / 60)} min
                            {alt.traffic_delay_s > 0 && <span style={{ color: '#fbbf24' }}> (+{Math.round(alt.traffic_delay_s / 60)}m delay)</span>}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '0.80rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          color: alt.overall_safety_score < 50 ? '#f87171' : '#fbbf24',
                          background: alt.overall_safety_score < 50 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          padding: '3px 8px',
                          borderRadius: '10px',
                          border: `1px solid ${alt.overall_safety_score < 50 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          Viability: {alt.composite_score ?? alt.overall_safety_score}/100
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Dark Map */}
        <div style={{
          position: 'relative',
          height: '75vh',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-md)'
        }}>
          {/* Floating Map Legend & Layer Switcher */}
          <div className="map-overlay-panel" style={{ top: 16, right: 16, width: '250px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} color="#38bdf8" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f8fafc' }}>
                  Navigation Visuals
                </span>
              </div>

              <button
                onClick={() => setTileMode(tileMode === 'dark' ? 'street' : 'dark')}
                className="chip-btn"
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                title="Toggle Map Style"
              >
                <Eye size={11} />
                <span>{tileMode === 'dark' ? 'Dark' : 'Street'}</span>
              </button>
            </div>

            {/* Mode Toggle: Traffic Flow vs Flood Safety */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setMapLayerMode('traffic')}
                className="chip-btn"
                style={{
                  flex: 1,
                  fontSize: '0.72rem',
                  padding: '4px 6px',
                  justifyContent: 'center',
                  background: mapLayerMode === 'traffic' ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                  color: mapLayerMode === 'traffic' ? '#0f172a' : '#94a3b8',
                  fontWeight: mapLayerMode === 'traffic' ? 800 : 600,
                  borderColor: mapLayerMode === 'traffic' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'
                }}
              >
                Live Traffic
              </button>
              <button
                type="button"
                onClick={() => setMapLayerMode('safety')}
                className="chip-btn"
                style={{
                  flex: 1,
                  fontSize: '0.72rem',
                  padding: '4px 6px',
                  justifyContent: 'center',
                  background: mapLayerMode === 'safety' ? '#38bdf8' : 'rgba(255, 255, 255, 0.05)',
                  color: mapLayerMode === 'safety' ? '#0f172a' : '#94a3b8',
                  fontWeight: mapLayerMode === 'safety' ? 800 : 600,
                  borderColor: mapLayerMode === 'safety' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'
                }}
              >
                Flood Safety
              </button>
            </div>

            {/* Dynamic Legend based on layer */}
            {mapLayerMode === 'traffic' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 16, height: 4, background: '#10b981', borderRadius: '2px', boxShadow: '0 0 6px #10b981' }}></div>
                  <span style={{ color: '#34d399', fontWeight: 500 }}>Free Flow Corridor</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 16, height: 4, background: '#f59e0b', borderRadius: '2px', boxShadow: '0 0 6px #f59e0b' }}></div>
                  <span style={{ color: '#fbbf24', fontWeight: 500 }}>Moderate Traffic</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 16, height: 4, background: '#f97316', borderRadius: '2px', boxShadow: '0 0 6px #f97316' }}></div>
                  <span style={{ color: '#fdba74', fontWeight: 500 }}>Heavy Congestion</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 16, height: 4, background: '#ef4444', borderRadius: '2px', boxShadow: '0 0 6px #ef4444' }}></div>
                  <span style={{ color: '#f87171', fontWeight: 500 }}>Gridlock / Flooded Choke Point</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 16, height: 4, background: '#10b981', borderRadius: '2px', boxShadow: '0 0 6px #10b981' }}></div>
                  <span style={{ color: '#34d399', fontWeight: 500 }}>Safe Clearance Pass</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 16, height: 4, background: '#f59e0b', borderRadius: '2px', boxShadow: '0 0 6px #f59e0b' }}></div>
                  <span style={{ color: '#fbbf24', fontWeight: 500 }}>Moderate Water Depth</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: 16, height: 4, background: '#ef4444', borderRadius: '2px', boxShadow: '0 0 6px #ef4444' }}></div>
                  <span style={{ color: '#f87171', fontWeight: 500 }}>Hazard Zone / Stall Risk</span>
                </div>
              </div>
            )}
          </div>

          <MapContainer
            center={initialCenter}
            zoom={12}
            className={tileMode === 'dark' ? 'map-dark-mode' : ''}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Auto-fit map to origin/dest/polyline */}
            <AutoFitRouteBounds
              origin={origCoords}
              destination={destCoords}
              points={activeRoute?.coordinates}
            />

            {/* Origin Marker */}
            {origCoords && (
              <Marker position={[origCoords.lat, origCoords.lon]} icon={startIcon}>
                <Popup>
                  <div style={{ fontFamily: 'var(--font-sans)', padding: '2px', color: '#f8fafc' }}>
                    <strong style={{ color: '#10b981' }}>Departure Origin</strong>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                      {origCoords.lat.toFixed(4)}, {origCoords.lon.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Destination Marker */}
            {destCoords && (
              <Marker position={[destCoords.lat, destCoords.lon]} icon={destIcon}>
                <Popup>
                  <div style={{ fontFamily: 'var(--font-sans)', padding: '2px', color: '#f8fafc' }}>
                    <strong style={{ color: '#06b6d4' }}>Target Destination</strong>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                      {destCoords.lat.toFixed(4)}, {destCoords.lon.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Bottlenecks & Flood Choke Points Markers */}
            {activeRoute?.traffic_bottlenecks?.map((b, bIdx) => (
              <Marker key={bIdx} position={[b.latitude, b.longitude]} icon={bottleneckIcon}>
                <Popup>
                  <div style={{ fontFamily: 'var(--font-sans)', padding: '4px', color: '#0f172a' }}>
                    <div style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.86rem' }}>
                      ⚠️ Waterlogged Choke Point
                    </div>
                    <div style={{ fontSize: '0.80rem', margin: '4px 0', color: '#334155' }}>
                      {b.description}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>
                      Queue Slowdown: +{Math.round(b.delay_s / 60)} min
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Render Polyline */}
            {mapLayerMode === 'traffic' && activeRoute?.traffic_segments && activeRoute.traffic_segments.length > 0 ? (
              // Multi-color traffic segmented polyline
              activeRoute.traffic_segments.map((seg, sIdx) => {
                const segCoords = seg.coordinates.map(c => [c.lat, c.lon]);
                return (
                  <React.Fragment key={sIdx}>
                    <Polyline
                      positions={segCoords}
                      pathOptions={{
                        color: seg.color,
                        weight: 10,
                        opacity: 0.35,
                        lineCap: 'round',
                        lineJoin: 'round'
                      }}
                    />
                    <Polyline
                      positions={segCoords}
                      pathOptions={{
                        color: seg.color,
                        weight: 5,
                        opacity: 0.95,
                        lineCap: 'round',
                        lineJoin: 'round'
                      }}
                    />
                  </React.Fragment>
                );
              })
            ) : (
              // Flood Safety Polyline
              polylinePositions.length >= 2 && (
                <>
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{
                      color: polylineColor,
                      weight: 10,
                      opacity: 0.35,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }}
                  />
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{
                      color: polylineColor,
                      weight: 5,
                      opacity: 0.95,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }}
                  />
                </>
              )
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

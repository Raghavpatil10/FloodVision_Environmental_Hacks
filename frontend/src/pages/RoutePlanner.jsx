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
  Eye
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

// Robust coordinate parser: handles degrees, cardinal (N/S/E/W), commas, spaces
const parseCoordinates = (str) => {
  if (!str || typeof str !== 'string') return null;
  const cleaned = str.trim();
  // Regex pattern matching: (float) [optional deg] [optional N/S] , (float) [optional deg] [optional E/W]
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
  // Fallback simple comma split
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

    try {
      const res = await axios.post(`${API_BASE_URL}/api/routes/plan`, {
        origin: origCoords,
        destination: destCoords
      });
      setRouteData(res.data);
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

  // Determine polyline positions
  const getPolylinePositions = () => {
    if (!routeData) return [];
    if (routeData.recommended_route?.coordinates && routeData.recommended_route.coordinates.length > 0) {
      return routeData.recommended_route.coordinates.map(c => [c.lat, c.lon]);
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
  const routeScore = routeData?.recommended_route?.overall_safety_score ?? 100;
  const polylineColor = routeScore < 50 ? '#ef4444' : (routeScore < 75 ? '#f59e0b' : '#10b981');

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
              Calculates vehicle-safe routing weighted against real-time waterlogging depths to prevent engine stall.
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

            <button 
              type="submit" 
              disabled={loading || !origCoords || !destCoords}
              className="btn btn-purple"
              style={{ width: '100%', padding: '13px', fontSize: '1rem', marginTop: '8px' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Evaluating Flood Corridors...</span>
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
          {routeData && routeData.recommended_route && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Optimal Safe Navigation
                </span>
                <span className={`badge ${routeScore < 50 ? 'badge-danger' : 'badge-safe'}`}>
                  <ShieldCheck size={14} />
                  <span>{routeScore < 50 ? 'High Risk' : 'Recommended'}</span>
                </span>
              </div>

              {/* Recommended Route Card */}
              <div className={`route-card ${routeScore < 50 ? 'route-card-danger' : 'route-card-safe'}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Distance</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                      {(routeData.recommended_route.total_distance_m / 1000).toFixed(2)} <span style={{ fontSize: '0.8rem' }}>km</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Est. Time</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
                      {Math.max(1, Math.round(routeData.recommended_route.total_duration_s / 60))} <span style={{ fontSize: '0.8rem' }}>min</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Safety</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: polylineColor }}>
                      {routeData.recommended_route.overall_safety_score} <span style={{ fontSize: '0.8rem' }}>/100</span>
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
                  <strong style={{ color: polylineColor }}>Reason: </strong>
                  {routeData.recommended_route.recommendation_reason || "No known flood incidents along this route."}
                </div>
              </div>

              {/* Alternative Routes Comparison */}
              {routeData.alternative_routes && routeData.alternative_routes.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Alternative Options
                  </div>
                  {routeData.alternative_routes.map((alt, idx) => (
                    <div key={idx} className="route-card route-card-alt" style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>Option {idx + 1} (Direct)</div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                            {(alt.total_distance_m / 1000).toFixed(2)} km • {Math.round(alt.total_duration_s / 60)} min
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 700, 
                          fontFamily: 'var(--font-mono)',
                          color: alt.overall_safety_score < 50 ? '#f87171' : '#fbbf24',
                          background: alt.overall_safety_score < 50 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          border: `1px solid ${alt.overall_safety_score < 50 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                        }}>
                          Score: {alt.overall_safety_score}/100
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
          {/* Floating Map Legend & Tile Switcher */}
          <div className="map-overlay-panel" style={{ top: 16, right: 16, width: '230px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} color="#38bdf8" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#f8fafc' }}>
                  Route Corridors
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 18, height: 4, background: '#10b981', borderRadius: '2px', boxShadow: '0 0 6px #10b981' }}></div>
                <span style={{ color: '#34d399', fontWeight: 500 }}>Safe Pass Corridor</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 18, height: 4, background: '#ef4444', borderRadius: '2px', boxShadow: '0 0 6px #ef4444' }}></div>
                <span style={{ color: '#f87171', fontWeight: 500 }}>Hazard Zone / Stall Risk</span>
              </div>
            </div>
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
              points={routeData?.recommended_route?.coordinates} 
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

            {/* Prominent glowing polyline */}
            {polylinePositions.length >= 2 && (
              <>
                {/* Background glow stroke */}
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
                {/* Core bright stroke */}
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
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

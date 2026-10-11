import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getUserLocation, searchLocations } from '../utils/geoUtils';
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
  Search,
  ShieldAlert,
  LocateFixed
} from 'lucide-react';
import { fetchWithFallback, getApiBaseUrl } from '../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

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

const createHazardIcon = () => {
  return new L.DivIcon({
    className: 'hazard-pin-marker',
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: 22px; height: 22px; border-radius: 50%; background: #ef4444; border: 2px solid #ffffff; box-shadow: 0 0 8px #ef4444; display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: 900;">⚠</div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });
};

const startIcon = createPinIcon('#10b981', 'Origin');
const destIcon = createPinIcon('#0284c7', 'Destination');

// Coordinate parser (also accepts raw coordinates if entered)
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
function AutoFitRouteBounds({ origin, destination, points, hazards }) {
  const map = useMap();

  useEffect(() => {
    const coordsList = [];
    if (points && points.length > 0) {
      points.forEach(p => coordsList.push([p.lat, p.lon]));
    } else {
      if (origin) coordsList.push([origin.lat, origin.lon]);
      if (destination) coordsList.push([destination.lat, destination.lon]);
    }

    if (hazards && hazards.length > 0) {
      hazards.forEach(h => {
        if (h.latitude && h.longitude) coordsList.push([h.latitude, h.longitude]);
      });
    }

    if (coordsList.length >= 2) {
      const bounds = L.latLngBounds(coordsList);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (coordsList.length === 1) {
      map.setView(coordsList[0], 13);
    }
  }, [origin, destination, points, hazards, map]);

  return null;
}

const PRESETS = [
  {
    name: 'Sitabuldi → Civil Lines (Nagpur Flood Reroute Test)',
    desc: 'Simulates path encountering waterlogged corridor and auto-rerouting around it',
    origin: 'Sitabuldi, Nagpur',
    destination: 'Civil Lines, Nagpur',
    originCoords: { lat: 21.1458, lon: 79.0882 },
    destCoords: { lat: 21.1610, lon: 79.0725 }
  },
  {
    name: 'Dharampeth → Nagpur Airport',
    desc: 'West to South arterial route in Nagpur',
    origin: 'Dharampeth, Nagpur',
    destination: 'Dr. Babasaheb Ambedkar International Airport, Nagpur',
    originCoords: { lat: 21.1428, lon: 79.0620 },
    destCoords: { lat: 21.0922, lon: 79.0472 }
  },
  {
    name: 'Bandra West → BKC (Mumbai)',
    desc: 'Low-lying flood bypass corridor in Mumbai',
    origin: 'Bandra West, Mumbai',
    destination: 'Bandra Kurla Complex, Mumbai',
    originCoords: { lat: 19.0596, lon: 72.8295 },
    destCoords: { lat: 19.0657, lon: 72.8687 }
  },
  {
    name: 'Dadar → Lower Parel (Mumbai)',
    desc: 'Monsoon waterlogging underpass bypass',
    origin: 'Dadar, Mumbai',
    destination: 'Lower Parel, Mumbai',
    originCoords: { lat: 19.0178, lon: 72.8478 },
    destCoords: { lat: 18.9953, lon: 72.8302 }
  }
];

export default function RoutePlanner() {
  const [origin, setOrigin] = useState(PRESETS[0].origin);
  const [destination, setDestination] = useState(PRESETS[0].destination);
  const [resolvedOriginCoords, setResolvedOriginCoords] = useState(PRESETS[0].originCoords);
  const [resolvedDestCoords, setResolvedDestCoords] = useState(PRESETS[0].destCoords);

  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tileMode, setTileMode] = useState('street');
  const [mobileTab, setMobileTab] = useState('planner'); // 'planner' | 'map'
  const [showRouteLegend, setShowRouteLegend] = useState(false);

  // Autocomplete suggestion states
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState(null);

  const debounceTimerRef = useRef(null);

  // Trigger geocode search on typing
  const handleLocationInputChange = (val, field) => {
    if (field === 'origin') {
      setOrigin(val);
      setResolvedOriginCoords(parseCoordinates(val));
    } else {
      setDestination(val);
      setResolvedDestCoords(parseCoordinates(val));
    }
    setActiveSuggestionField(field);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      if (val.trim().length >= 3 && !parseCoordinates(val)) {
        const results = await searchLocations(val.trim());
        if (field === 'origin') {
          setOriginSuggestions(results);
        } else {
          setDestSuggestions(results);
        }
      } else {
        if (field === 'origin') setOriginSuggestions([]);
        else setDestSuggestions([]);
      }
    }, 350);
  };

  const handleSelectSuggestion = (item, field) => {
    if (field === 'origin') {
      setOrigin(item.name || item.display_name.split(',')[0]);
      setResolvedOriginCoords({ lat: item.lat, lon: item.lon });
      setOriginSuggestions([]);
    } else {
      setDestination(item.name || item.display_name.split(',')[0]);
      setResolvedDestCoords({ lat: item.lat, lon: item.lon });
      setDestSuggestions([]);
    }
    setActiveSuggestionField(null);
    setRouteData(null);
  };

  // Quick fill current location for Origin
  const handleUseCurrentLocation = async () => {
    setLoading(true);
    try {
      const loc = await getUserLocation();
      const name = loc.city ? `Current Location (${loc.city})` : 'Current Location';
      setOrigin(name);
      setResolvedOriginCoords({ lat: loc.lat, lon: loc.lon });
      setRouteData(null);
    } catch (e) {
      console.warn("Could not get user location:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanRoute = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setRouteData(null);
    setOriginSuggestions([]);
    setDestSuggestions([]);

    if (!origin.trim() || !destination.trim()) {
      setError("Please enter both Start Location and Destination.");
      return;
    }

    setLoading(true);

    try {
      // 1. Resolve Origin Coordinates (if not already parsed)
      let oCoords = resolvedOriginCoords || parseCoordinates(origin);
      if (!oCoords) {
        const oResults = await searchLocations(origin.trim());
        if (oResults && oResults.length > 0) {
          oCoords = { lat: oResults[0].lat, lon: oResults[0].lon };
          setResolvedOriginCoords(oCoords);
        } else {
          throw new Error(`Could not locate start location: "${origin}". Please check spelling or include city.`);
        }
      }

      // 2. Resolve Destination Coordinates (if not already parsed)
      let dCoords = resolvedDestCoords || parseCoordinates(destination);
      if (!dCoords) {
        const dResults = await searchLocations(destination.trim());
        if (dResults && dResults.length > 0) {
          dCoords = { lat: dResults[0].lat, lon: dResults[0].lon };
          setResolvedDestCoords(dCoords);
        } else {
          throw new Error(`Could not locate destination: "${destination}". Please check spelling or include city.`);
        }
      }

      // 3. Plan route with dynamic hazard avoidance
      const res = await fetchWithFallback('/api/routes/plan', {
        method: 'POST',
        data: {
          origin: oCoords,
          destination: dCoords,
          origin_name: origin,
          destination_name: destination
        }
      });

      setRouteData(res.data);

      if (window.innerWidth <= 920) {
        setMobileTab('map');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not plan route.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const tempName = origin;
    const tempCoords = resolvedOriginCoords;
    setOrigin(destination);
    setResolvedOriginCoords(resolvedDestCoords);
    setDestination(tempName);
    setResolvedDestCoords(tempCoords);
    setRouteData(null);
  };

  const handleApplyPreset = (p) => {
    setOrigin(p.origin);
    setDestination(p.destination);
    setResolvedOriginCoords(p.originCoords || null);
    setResolvedDestCoords(p.destCoords || null);
    setError(null);
    setRouteData(null);
  };

  // Determine polyline positions for recommended route
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

  // Determine avoided hazardous route polyline if available
  const getAvoidedPolylinePositions = () => {
    if (!routeData || !routeData.alternative_routes || routeData.alternative_routes.length === 0) return [];
    const blockedAlt = routeData.alternative_routes.find(alt => alt.critical_hazards > 0 || alt.overall_safety_score < 70);
    if (blockedAlt && blockedAlt.coordinates && blockedAlt.coordinates.length > 0) {
      return blockedAlt.coordinates.map(c => [c.lat, c.lon]);
    }
    return [];
  };

  const polylinePositions = getPolylinePositions();
  const avoidedPolylinePositions = getAvoidedPolylinePositions();

  const isRerouted = routeData?.recommended_route?.is_rerouted;
  const routeScore = routeData?.recommended_route?.overall_safety_score ?? 100;
  const polylineColor = isRerouted ? '#10b981' : (routeScore < 50 ? '#ef4444' : (routeScore < 75 ? '#f59e0b' : '#10b981'));

  const avoidedHazards = routeData?.recommended_route?.hazard_incidents || 
    (routeData?.alternative_routes && routeData.alternative_routes[0]?.hazard_incidents) || [];

  const initialCenter = resolvedOriginCoords ? [resolvedOriginCoords.lat, resolvedOriginCoords.lon] : [21.1463, 79.0849];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Mobile Tab Switcher */}
      <div className="mobile-route-switcher">
        <button
          type="button"
          onClick={() => setMobileTab('planner')}
          className="btn"
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '0.86rem',
            fontWeight: 800,
            background: mobileTab === 'planner' ? '#FFCE32' : '#ffffff',
            color: '#111111',
            border: '2px solid #111111',
            boxShadow: '2px 2px 0px #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Compass size={16} />
          <span>Setup Route</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className="btn"
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '0.86rem',
            fontWeight: 800,
            background: mobileTab === 'map' ? '#FFCE32' : '#ffffff',
            color: '#111111',
            border: '2px solid #111111',
            boxShadow: '2px 2px 0px #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Navigation size={16} />
          <span>Route Map {routeData ? '✓' : ''}</span>
        </button>
      </div>

      <div className="route-planner-grid">
        {/* Left Column: Route Controller Panel */}
        <div 
          className={`glass-card ${mobileTab !== 'planner' ? 'route-panel-hidden' : ''}`} 
          style={{ 
            padding: '24px', 
            background: '#ffffff',
            border: '3px solid #111111',
            boxShadow: '6px 6px 0px #111111',
            color: '#111111'
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '8px', 
                background: '#f3e8ff', border: '2px solid #111111',
                boxShadow: '2px 2px 0px #111111', display: 'flex', 
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Compass size={20} color="#9333ea" />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#111111' }}>
                Safe Route Planner
              </h2>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.86rem', lineHeight: 1.5, fontWeight: 500 }}>
              Enter start and end location names. FloodVision monitors active waterlogging reports along the path and dynamically calculates safe detours.
            </p>
          </div>

          {/* Quick Demo Presets */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.78rem', 
              fontWeight: 800, 
              color: '#475569', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              marginBottom: '8px'
            }}>
              <Sparkles size={14} color="#0284c7" />
              <span>Tested Route Scenarios</span>
            </div>
            <div className="presets-scroll-strip" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="chip-btn"
                  title={p.desc}
                  style={{
                    whiteSpace: 'nowrap',
                    background: '#f8fafc',
                    border: '2px solid #111111',
                    boxShadow: '2px 2px 0px #111111',
                    color: '#111111',
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700
                  }}
                >
                  <MapPin size={12} color="#0284c7" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form with Location Names */}
          <form onSubmit={handlePlanRoute} style={{ position: 'relative' }}>
            {/* Origin Input */}
            <div className="form-group" style={{ position: 'relative', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ color: '#111111', fontWeight: 800, fontSize: '0.86rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={15} color="#16a34a" />
                  <span>Start Location (Name or Landmark):</span>
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="btn"
                  style={{
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #0284c7',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <LocateFixed size={12} />
                  <span>Use My Location</span>
                </button>
              </div>

              <input 
                className="form-input"
                value={origin} 
                onChange={e => handleLocationInputChange(e.target.value, 'origin')}
                onFocus={() => setActiveSuggestionField('origin')}
                placeholder="e.g. Sitabuldi, Nagpur or Dharampeth" 
                style={{
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  width: '100%',
                  background: '#ffffff',
                  color: '#111111'
                }}
              />

              {/* Origin Autocomplete Suggestions */}
              {activeSuggestionField === 'origin' && originSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  boxShadow: '4px 4px 0px #111111',
                  zIndex: 2000,
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  {originSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectSuggestion(item, 'origin')}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        color: '#111111'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                    >
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.display_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resolvedOriginCoords && (
                <div style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 700, marginTop: '4px' }}>
                  ✓ Pinned: Lat {resolvedOriginCoords.lat.toFixed(4)}, Lon {resolvedOriginCoords.lon.toFixed(4)}
                </div>
              )}
            </div>

            {/* Swap Directions Button */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px 0' }}>
              <button 
                type="button" 
                onClick={handleSwap} 
                className="chip-btn"
                style={{
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  background: '#ffffff',
                  border: '2px solid #111111',
                  boxShadow: '2px 2px 0px #111111',
                  color: '#111111'
                }}
                title="Swap Start and Destination"
              >
                <ArrowUpDown size={13} />
                <span>Swap Locations</span>
              </button>
            </div>

            {/* Destination Input */}
            <div className="form-group" style={{ position: 'relative', marginBottom: '18px' }}>
              <label className="form-label" style={{ color: '#111111', fontWeight: 800, fontSize: '0.86rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flag size={15} color="#0284c7" />
                <span>Destination (Name or Landmark):</span>
              </label>
              <input 
                className="form-input"
                value={destination} 
                onChange={e => handleLocationInputChange(e.target.value, 'destination')}
                onFocus={() => setActiveSuggestionField('destination')}
                placeholder="e.g. Civil Lines, Nagpur or Nagpur Airport" 
                style={{
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  width: '100%',
                  background: '#ffffff',
                  color: '#111111'
                }}
              />

              {/* Destination Autocomplete Suggestions */}
              {activeSuggestionField === 'destination' && destSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  boxShadow: '4px 4px 0px #111111',
                  zIndex: 2000,
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  {destSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectSuggestion(item, 'destination')}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        color: '#111111'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                    >
                      <div style={{ fontWeight: 800 }}>{item.name}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.display_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {resolvedDestCoords && (
                <div style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 700, marginTop: '4px' }}>
                  ✓ Pinned: Lat {resolvedDestCoords.lat.toFixed(4)}, Lon {resolvedDestCoords.lon.toFixed(4)}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading || !origin.trim() || !destination.trim()}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 800 }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Evaluating Flood Corridors & Safety...</span>
                </>
              ) : (
                <>
                  <Navigation size={18} />
                  <span>Plan Safe Route (Auto-Reroute Active)</span>
                  <ArrowRight size={18} />
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
              background: '#fee2e2',
              border: '2px solid #ef4444',
              color: '#b91c1c',
              fontSize: '0.86rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Route Results & Reroute Banner */}
          {routeData && routeData.recommended_route && (
            <div style={{ marginTop: '24px', borderTop: '2px dashed #cbd5e1', paddingTop: '20px' }}>
              
              {/* Active Reroute Badge Banner */}
              {isRerouted && (
                <div style={{
                  padding: '14px 16px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  boxShadow: '3px 3px 0px #ef4444',
                  marginBottom: '16px',
                  color: '#991b1b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.94rem' }}>
                    <ShieldAlert size={18} color="#dc2626" />
                    <span>⚠️ Hazard Detected: Route Rerouted Around Flood!</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.45 }}>
                    A direct waterlogged corridor was detected. FloodVision actively recalculated a detour via clear roads to prevent vehicle stall.
                  </div>
                  {avoidedHazards.length > 0 && (
                    <div style={{ fontSize: '0.78rem', marginTop: '6px', fontWeight: 700, color: '#dc2626' }}>
                      Bypassed Hazard: {avoidedHazards[0].estimated_depth_cm} cm water depth near Lat {avoidedHazards[0].latitude?.toFixed(4)}, Lon {avoidedHazards[0].longitude?.toFixed(4)}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
                  Optimal Safe Navigation
                </span>
                <span className={`badge ${routeScore < 50 ? 'badge-danger' : 'badge-safe'}`}>
                  <ShieldCheck size={14} />
                  <span>{isRerouted ? 'Safe Detour Active' : (routeScore < 50 ? 'High Risk' : 'Clear Route')}</span>
                </span>
              </div>

              {/* Recommended Route Card */}
              <div style={{
                background: isRerouted ? '#f0fdf4' : '#ffffff',
                border: '3px solid #111111',
                boxShadow: '4px 4px 0px #111111',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '14px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#111111', fontWeight: 800, textTransform: 'uppercase' }}>Distance</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                      {(routeData.recommended_route.total_distance_m / 1000).toFixed(2)} <span style={{ fontSize: '0.8rem' }}>km</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#111111', fontWeight: 800, textTransform: 'uppercase' }}>Est. Time</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#111111' }}>
                      {Math.max(1, Math.round(routeData.recommended_route.total_duration_s / 60))} <span style={{ fontSize: '0.8rem' }}>min</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#111111', fontWeight: 800, textTransform: 'uppercase' }}>Safety Index</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: polylineColor }}>
                      {routeData.recommended_route.overall_safety_score} <span style={{ fontSize: '0.8rem' }}>/100</span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  fontSize: '0.88rem', 
                  color: '#111111', 
                  borderTop: '2px solid rgba(0, 0, 0, 0.15)',
                  paddingTop: '10px',
                  lineHeight: 1.45,
                  fontWeight: 600
                }}>
                  <strong style={{ color: polylineColor }}>Navigation Note: </strong>
                  {routeData.recommended_route.recommendation_reason || "Direct route clear of recorded waterlogging."}
                </div>
              </div>

              {/* Alternative Routes Comparison */}
              {routeData.alternative_routes && routeData.alternative_routes.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginBottom: '8px' }}>
                    Compared Direct Corridors
                  </div>
                  {routeData.alternative_routes.map((alt, idx) => (
                    <div key={idx} style={{
                      background: '#ffffff',
                      border: '2px solid #111111',
                      boxShadow: '2px 2px 0px #111111',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#111111' }}>
                          Option {idx + 1}: {alt.critical_hazards > 0 ? 'Direct Route (Blocked by Flood ⚠)' : 'Alternative Corridor'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                          {(alt.total_distance_m / 1000).toFixed(2)} km • {Math.round(alt.total_duration_s / 60)} min
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: '0.82rem', 
                        fontWeight: 800, 
                        color: alt.overall_safety_score < 50 ? '#dc2626' : '#d97706',
                        background: alt.overall_safety_score < 50 ? '#fee2e2' : '#fef3c7',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #111111'
                      }}>
                        Score: {alt.overall_safety_score}/100
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map */}
        <div 
          className={`route-planner-map ${mobileTab !== 'map' ? 'route-panel-hidden' : ''}`}
          style={{ 
            position: 'relative', 
            height: '78vh', 
            borderRadius: 'var(--radius-lg)', 
            overflow: 'hidden', 
            border: '3px solid #111111',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          {/* Mobile Back to Setup Button */}
          <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 1000
          }}>
            <button
              type="button"
              onClick={() => setMobileTab('planner')}
              className="chip-btn"
              style={{
                background: '#ffffff',
                color: '#111111',
                border: '2px solid #111111',
                boxShadow: '2px 2px 0px #111111',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800
              }}
            >
              <span>⬅️ Edit Locations</span>
            </button>
          </div>

          {/* Top Control Bar on Route Map */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1000,
            display: 'flex',
            gap: '8px'
          }}>
            <button
              type="button"
              onClick={() => setShowRouteLegend(!showRouteLegend)}
              className="chip-btn"
              style={{
                background: showRouteLegend ? '#FFCE32' : '#ffffff',
                color: '#111111',
                border: '2px solid #111111',
                boxShadow: '2px 2px 0px #111111',
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 800
              }}
            >
              <Layers size={13} />
              <span>{showRouteLegend ? 'Hide Legend' : 'Legend'}</span>
            </button>

            <button
              type="button"
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

          {/* Floating Map Legend */}
          <div 
            className={`map-overlay-panel route-legend-overlay ${showRouteLegend ? 'mobile-open' : ''}`} 
            style={{ 
              top: 12, 
              right: 12, 
              width: '240px', 
              maxWidth: 'calc(100vw - 32px)',
              background: '#ffffff',
              border: '2px solid #111111',
              boxShadow: '4px 4px 0px #111111',
              padding: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} color="#0284c7" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#111111' }}>
                  Route Corridors
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRouteLegend(false)}
                style={{ background: 'none', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 18, height: 4, background: '#10b981', borderRadius: '2px' }}></div>
                <span style={{ color: '#15803d', fontWeight: 800 }}>Safe Detour / Clear Pass</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 18, height: 4, background: '#ef4444', borderRadius: '2px', borderStyle: 'dashed' }}></div>
                <span style={{ color: '#b91c1c', fontWeight: 800 }}>Avoided Flood Hazard Zone</span>
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

            <AutoFitRouteBounds 
              origin={resolvedOriginCoords} 
              destination={resolvedDestCoords} 
              points={routeData?.recommended_route?.coordinates} 
              hazards={avoidedHazards}
            />

            {/* Origin Marker */}
            {resolvedOriginCoords && (
              <Marker position={[resolvedOriginCoords.lat, resolvedOriginCoords.lon]} icon={startIcon}>
                <Popup>
                  <div style={{ fontFamily: 'var(--font-sans)', padding: '2px', color: '#111111' }}>
                    <strong style={{ color: '#15803d' }}>Departure: {origin}</strong>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      Lat: {resolvedOriginCoords.lat.toFixed(4)}, Lon: {resolvedOriginCoords.lon.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Destination Marker */}
            {resolvedDestCoords && (
              <Marker position={[resolvedDestCoords.lat, resolvedDestCoords.lon]} icon={destIcon}>
                <Popup>
                  <div style={{ fontFamily: 'var(--font-sans)', padding: '2px', color: '#111111' }}>
                    <strong style={{ color: '#0369a1' }}>Destination: {destination}</strong>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      Lat: {resolvedDestCoords.lat.toFixed(4)}, Lon: {resolvedDestCoords.lon.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Avoided Flood Hazard Marker(s) on Map */}
            {avoidedHazards.map((hazard, hIdx) => {
              if (!hazard.latitude || !hazard.longitude) return null;
              return (
                <Marker 
                  key={hIdx} 
                  position={[hazard.latitude, hazard.longitude]} 
                  icon={createHazardIcon()}
                >
                  <Popup>
                    <div style={{ minWidth: '180px', fontFamily: 'var(--font-sans)', color: '#111111' }}>
                      <div style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={16} />
                        <span>Avoided Flood Hazard Zone</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', margin: '4px 0' }}>
                        Water Depth: <strong>{hazard.estimated_depth_cm} cm</strong> ({hazard.risk_level?.toUpperCase() || 'CRITICAL'})
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 700 }}>
                        ✓ Safe navigation steered detour around this spot.
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Avoided Hazardous Direct Route (Rendered in dashed red) */}
            {avoidedPolylinePositions.length >= 2 && (
              <Polyline 
                positions={avoidedPolylinePositions} 
                pathOptions={{
                  color: '#ef4444',
                  weight: 4,
                  opacity: 0.6,
                  dashArray: '8, 8',
                  lineCap: 'round'
                }}
              />
            )}

            {/* Recommended Safe Polyline (Rendered in Emerald Green) */}
            {polylinePositions.length >= 2 && (
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
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

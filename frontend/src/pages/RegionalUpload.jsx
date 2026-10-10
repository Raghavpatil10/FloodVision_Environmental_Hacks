import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { 
  Camera, 
  UploadCloud, 
  MapPin, 
  Navigation, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  RefreshCw, 
  ShieldAlert, 
  Compass, 
  LocateFixed, 
  Check, 
  X,
  FileText,
  Eye,
  Info
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Fix leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Calculate distance in km
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map Click Listener
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Controller to smoothly pan map
function MapCenterController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function RegionalUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Region state
  const [region, setRegion] = useState(null);
  const [loadingRegion, setLoadingRegion] = useState(true);
  const [regionError, setRegionError] = useState(null);

  // Form fields
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('moderate');

  // Location selection state
  const [selectedCoords, setSelectedCoords] = useState(null); // { lat, lon }
  const [addressText, setAddressText] = useState('');
  const [locationSource, setLocationSource] = useState(null); // 'gps' | 'manual'
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null); // Result payload

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchActiveRegion();
  }, []);

  const fetchActiveRegion = async () => {
    setLoadingRegion(true);
    setRegionError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/images?limit=1`);
      if (res.data.region) {
        setRegion(res.data.region);
        // Default coordinates to center of assigned region
        setSelectedCoords({
          lat: res.data.region.center_latitude,
          lon: res.data.region.center_longitude
        });
      } else {
        setRegionError("No active geographic region assigned to your administrator account.");
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setRegionError(detail || "Failed to load assigned regional boundary. Administrator clearance required.");
    } finally {
      setLoadingRegion(false);
    }
  };

  // Reverse Geocoding helper
  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          setAddressText(data.display_name);
          return;
        }
      }
    } catch (e) {
      console.warn("Reverse geocode failed:", e);
    }
    setAddressText(`Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`);
  };

  // Option A: Use My Current Location
  const handleUseCurrentLocation = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setSelectedCoords({ lat, lon });
        setLocationSource('gps');
        setGpsLoading(false);
        reverseGeocode(lat, lon);
      },
      (err) => {
        setGpsLoading(false);
        let msg = "Failed to obtain current device location.";
        if (err.code === 1) {
          msg = "Location permission denied. Please allow GPS access in your browser or select on map.";
        } else if (err.code === 2) {
          msg = "GPS location unavailable or satellite signal lost. Please select manually on the map.";
        } else if (err.code === 3) {
          msg = "GPS request timed out. Please try again or select location on the map.";
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Option B: Manual map selection
  const handleMapLocationSelect = (lat, lon) => {
    setSelectedCoords({ lat, lon });
    setLocationSource('manual');
    setGpsError(null);
    reverseGeocode(lat, lon);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!validTypes.includes(selected.type)) {
        setUploadError("Invalid format. Only JPEG, PNG, and WebP images are supported.");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setUploadError("Image file size exceeds maximum 10 MB limit.");
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setUploadError(null);
    }
  };

  // Check if selected location is within assigned region
  const isInsideAssignedRegion = () => {
    if (!region || !selectedCoords) return false;
    const dist = haversineDistanceKm(
      selectedCoords.lat,
      selectedCoords.lon,
      region.center_latitude,
      region.center_longitude
    );
    return dist <= region.radius_km;
  };

  const distanceToCenter = () => {
    if (!region || !selectedCoords) return 0;
    return haversineDistanceKm(
      selectedCoords.lat,
      selectedCoords.lon,
      region.center_latitude,
      region.center_longitude
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!file) {
      setUploadError("Please select or capture a flood photograph.");
      return;
    }
    if (!selectedCoords) {
      setUploadError("Please select a location using current GPS or the map.");
      return;
    }

    setSubmitting(true);
    const data = new FormData();
    data.append("file", file);
    data.append("title", title.trim());
    data.append("description", description.trim());
    data.append("latitude", selectedCoords.lat);
    data.append("longitude", selectedCoords.lon);
    data.append("severity", severity);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/images`, data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadSuccess(res.data);
      // Reset form fields
      setFile(null);
      setPreviewUrl(null);
      setTitle('');
      setDescription('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setUploadError(detail || "Failed to upload image. Please verify your permissions and selected location.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingRegion) {
    return (
      <div style={{ maxWidth: '800px', margin: '60px auto', textAlign: 'center', padding: '40px' }}>
        <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px auto', color: '#0ea5e9' }} />
        <h3 style={{ fontWeight: 800 }}>Loading regional boundary...</h3>
      </div>
    );
  }

  if (regionError || !region) {
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 16px' }}>
        <BackButton to="/admin/dashboard" label="Back to Dashboard" />
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center', background: '#fff', border: '3px solid #111' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '10px' }}>Regional Assignment Missing</h2>
          <p style={{ color: '#475569', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 20px auto' }}>
            {regionError || "You must have an active geographic region assigned by a platform Superadmin before uploading regional flood imagery."}
          </p>
          <Link to="/user/dashboard" className="btn btn-primary" style={{ padding: '8px 18px', background: '#0ea5e9' }}>
            Go to User Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const mapCenter = [region.center_latitude, region.center_longitude];
  const isInside = isInsideAssignedRegion();
  const distKm = distanceToCenter();

  return (
    <div style={{ maxWidth: '960px', margin: '24px auto 60px auto', padding: '0 16px' }}>
      
      {/* Top Left Theme-Consistent Back Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
        <BackButton to="/admin/dashboard" label="Back to Admin Dashboard" />
      </div>

      {/* Header Banner */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '20px 24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#FFCE32',
                color: '#111111',
                border: '1.5px solid #111111',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 900,
                textTransform: 'uppercase'
              }}>
                Regional Administrator
              </span>
              <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Assigned Sector</span>
            </div>
            <h2 style={{ margin: '6px 0 0 0', fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
              Upload Flood Image — {region.region_name}
            </h2>
          </div>

          <div style={{
            background: '#f8fafc',
            border: '2px solid #111111',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '0.82rem',
            boxShadow: '2px 2px 0px #111111'
          }}>
            <div><strong>Center:</strong> {region.center_latitude.toFixed(4)}, {region.center_longitude.toFixed(4)}</div>
            <div style={{ marginTop: '2px' }}><strong>Authorized Radius:</strong> {region.radius_km} km</div>
          </div>
        </div>
      </div>

      {/* Success Notification Modal / Card */}
      {uploadSuccess && (
        <div style={{
          marginBottom: '24px',
          padding: '20px 24px',
          background: '#f0fdf4',
          border: '3px solid #16a34a',
          borderRadius: '10px',
          boxShadow: '4px 4px 0px #16a34a'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={24} color="#16a34a" />
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#15803d' }}>
                  Upload Confirmed & Verified Within Assigned Region!
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#166534' }}>
                  {uploadSuccess.message} Image ID: <code>{uploadSuccess.image?.id}</code>
                </p>
              </div>
            </div>
            <button
              onClick={() => setUploadSuccess(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* YOLO Telemetry Summary */}
          {uploadSuccess.image?.yolo_results && (
            <div style={{
              marginTop: '14px',
              padding: '12px 16px',
              background: '#ffffff',
              border: '2px solid #111111',
              borderRadius: '8px',
              display: 'flex',
              gap: '20px',
              flexWrap: 'wrap',
              fontSize: '0.85rem'
            }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 800 }}>ESTIMATED DEPTH</span>
                <strong style={{ fontSize: '1.2rem', color: '#0284c7' }}>
                  {uploadSuccess.image.estimated_depth_cm !== null ? `${uploadSuccess.image.estimated_depth_cm} cm` : 'Pending'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 800 }}>FLOOD RISK</span>
                <strong style={{ textTransform: 'uppercase', color: uploadSuccess.image.yolo_results?.risk_level === 'critical' ? '#ef4444' : '#10b981' }}>
                  {uploadSuccess.image.yolo_results?.risk_level || 'Normal'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', fontWeight: 800 }}>SUBMERSION RATIO</span>
                <strong>{uploadSuccess.image.yolo_results?.submerged_ratio ? `${(uploadSuccess.image.yolo_results.submerged_ratio * 100).toFixed(1)}%` : '0%'}</strong>
              </div>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <Link
              to="/admin/dashboard"
              className="btn btn-primary"
              style={{ padding: '8px 16px', background: '#16a34a', fontSize: '0.85rem' }}
            >
              View In Regional Dashboard Gallery
            </Link>
          </div>
        </div>
      )}

      {/* Main Upload Grid */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          
          {/* Left Column: Image Selection & Details */}
          <div className="glass-card" style={{ padding: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 900 }}>
              1. Select Image & Metadata
            </h3>

            {/* Image Preview / Picker Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                height: '220px',
                border: '2px dashed #111111',
                borderRadius: '8px',
                background: previewUrl ? '#000' : '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: '16px'
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#FFCE32',
                    border: '2px solid #111',
                    margin: '0 auto 10px auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Camera size={24} color="#111" />
                  </div>
                  <strong style={{ display: 'block', fontSize: '0.92rem' }}>Click to select image or take photo</strong>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>JPEG, PNG, WebP (Max 10 MB)</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            {/* Title */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                Image Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Submerged Underpass at 5th Cross"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  background: '#ffffff'
                }}
              />
            </div>

            {/* Severity Category */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                Estimated Hazard Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  background: '#ffffff',
                  fontWeight: 600
                }}
              >
                <option value="low">Low (Puddle accumulation &lt; 15cm)</option>
                <option value="moderate">Moderate (Tire partially submerged ~ 15-30cm)</option>
                <option value="high">High (Exceeds 30cm car stall threshold)</option>
                <option value="critical">Critical (Severe flooding / impassable road)</option>
              </select>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                Description / Field Observations
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Observed vehicle stall risks, drainage blockages, or traffic diversion details..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontFamily: 'inherit',
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  fontSize: '0.88rem',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>

          {/* Right Column: GPS & Interactive Map Selection */}
          <div className="glass-card" style={{ padding: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.15rem', fontWeight: 900 }}>
              2. Location Selection
            </h3>

            {/* Option Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {/* Option A Button */}
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={gpsLoading}
                className="btn"
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  background: locationSource === 'gps' ? '#10b981' : '#38bdf8',
                  color: '#ffffff',
                  border: '2px solid #111111',
                  boxShadow: '2px 2px 0px #111111',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {gpsLoading ? (
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <LocateFixed size={15} />
                )}
                <span>Use My Current Location</span>
              </button>

              {/* Option B Indicator */}
              <button
                type="button"
                onClick={() => setLocationSource('manual')}
                className="btn"
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  background: locationSource === 'manual' ? '#FFCE32' : '#ffffff',
                  color: '#111111',
                  border: '2px solid #111111',
                  boxShadow: '2px 2px 0px #111111',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Compass size={15} />
                <span>Choose Location on Map</span>
              </button>
            </div>

            {/* GPS Error alert */}
            {gpsError && (
              <div style={{
                padding: '10px 12px',
                background: '#fee2e2',
                border: '1.5px solid #ef4444',
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: '#991b1b',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{gpsError}</span>
              </div>
            )}

            {/* Leaflet Map Preview */}
            <div style={{
              height: '240px',
              border: '2px solid #111111',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '14px',
              position: 'relative'
            }}>
              <MapContainer
                center={selectedCoords ? [selectedCoords.lat, selectedCoords.lon] : mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Visual Authorized Regional Boundary */}
                <Circle
                  center={mapCenter}
                  radius={region.radius_km * 1000}
                  pathOptions={{
                    color: '#0284c7',
                    fillColor: '#38bdf8',
                    fillOpacity: 0.15,
                    weight: 2,
                    dashArray: '4, 4'
                  }}
                />

                {/* Selected Location Marker (Draggable) */}
                {selectedCoords && (
                  <Marker
                    position={[selectedCoords.lat, selectedCoords.lon]}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const marker = e.target;
                        const pos = marker.getLatLng();
                        handleMapLocationSelect(pos.lat, pos.lng);
                      }
                    }}
                  />
                )}

                <MapClickHandler onLocationSelect={handleMapLocationSelect} />
                {selectedCoords && <MapCenterController center={[selectedCoords.lat, selectedCoords.lon]} />}
              </MapContainer>
            </div>

            {/* Coordinates & Regional Boundary Verification Card */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: isInside ? '#f0fdf4' : '#fef2f2',
              border: `2px solid ${isInside ? '#22c55e' : '#ef4444'}`,
              boxShadow: '2px 2px 0px #111',
              fontSize: '0.84rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>Selected Coordinates:</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  background: isInside ? '#dcfce7' : '#fee2e2',
                  color: isInside ? '#166534' : '#b91c1c',
                  border: `1px solid ${isInside ? '#166534' : '#b91c1c'}`
                }}>
                  {isInside ? 'Inside Assigned Region' : 'Outside Authorized Region'}
                </span>
              </div>

              {selectedCoords && (
                <div>
                  <code>Lat: {selectedCoords.lat.toFixed(5)}, Lon: {selectedCoords.lon.toFixed(5)}</code>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '3px' }}>
                    Distance from Region Center: <strong>{distKm.toFixed(2)} km</strong> (Authorized Radius: {region.radius_km} km)
                  </div>
                </div>
              )}

              {addressText && (
                <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#334155', fontStyle: 'italic' }}>
                  {addressText}
                </div>
              )}

              {!isInside && (
                <div style={{ marginTop: '8px', color: '#b91c1c', fontWeight: 700, fontSize: '0.8rem' }}>
                  ⚠️ Upload will be denied: Coordinates exceed the authorized {region.radius_km} km boundary for {region.region_name}. Click within the blue perimeter on the map to re-select.
                </div>
              )}
            </div>

            {/* Server Error Alert */}
            {uploadError && (
              <div style={{
                marginTop: '14px',
                padding: '12px 14px',
                background: '#fee2e2',
                border: '2px solid #ef4444',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Submit Button */}
            <div style={{ marginTop: '20px' }}>
              <button
                type="submit"
                disabled={submitting || !file || !isInside}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '0.94rem',
                  fontWeight: 900,
                  background: isInside ? '#0ea5e9' : '#94a3b8',
                  color: '#ffffff',
                  border: '2px solid #111111',
                  boxShadow: '3px 3px 0px #111111',
                  cursor: isInside ? 'pointer' : 'not-allowed'
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Verifying & Running YOLOv8 Inference...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    <span>Upload & Process Regional Image</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </form>

    </div>
  );
}

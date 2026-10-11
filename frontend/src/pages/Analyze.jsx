import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserLocation, searchLocations } from '../utils/geoUtils';
import { 
  Camera, 
  UploadCloud, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowRight, 
  RefreshCw, 
  Activity,
  Maximize2,
  BellRing,
  Radio,
  Check,
  Lock,
  LogIn,
  UserCheck,
  X,
  Search,
  Compass
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function Analyze() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [manualLocationText, setManualLocationText] = useState('');
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showSmsToast, setShowSmsToast] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auto-acquire user location on load (via GPS or IP fallback)
  useEffect(() => {
    fetchAutoLocation();
  }, []);

  const fetchAutoLocation = async () => {
    setLocating(true);
    try {
      const loc = await getUserLocation();
      setCoords({ lat: loc.lat, lon: loc.lon });
      setLocationLabel(loc.label || `${loc.city || 'Detected Area'} (${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)})`);
    } catch (e) {
      console.warn("Location error:", e);
    } finally {
      setLocating(false);
    }
  };

  const handleManualLocationSearch = async (e) => {
    if (e) e.preventDefault();
    if (!manualLocationText.trim()) return;
    setLocating(true);
    try {
      const results = await searchLocations(manualLocationText.trim());
      if (results && results.length > 0) {
        const top = results[0];
        setCoords({ lat: top.lat, lon: top.lon });
        setLocationLabel(`${top.name} (${top.lat.toFixed(4)}, ${top.lon.toFixed(4)})`);
        setShowLocationSearch(false);
        setManualLocationText('');
      } else {
        alert(`Could not find coordinates for "${manualLocationText}". Try adding city name.`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLocating(false);
    }
  };

  const handleFile = (selected) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (selected && (selected.type === 'image/jpeg' || selected.type === 'image/png' || selected.type === 'image/jpg')) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
      setShowSmsToast(false);
    } else if (selected) {
      setError('Please upload a valid JPEG or PNG image.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDropzoneClick = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const input = document.getElementById('file-upload-input');
    if (input) input.click();
  };

  const handleCameraCaptureClick = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const input = document.getElementById('camera-capture-input');
    if (input) input.click();
  };

  const requestLocation = () => {
    fetchAutoLocation();
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!file) return;

    setLoading(true);
    setError(null);
    setShowSmsToast(false);
    const formData = new FormData();
    formData.append('file', file);
    if (coords) {
      formData.append('latitude', coords.lat);
      formData.append('longitude', coords.lon);
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/analyze`, formData);
      setResult(res.data);
      if (res.data.sms_alert_sent) {
        setShowSmsToast(true);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || err.message || 'An error occurred during computer vision analysis.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'Safe') {
      return { className: 'badge-safe', icon: CheckCircle2, label: 'SAFE (0 - 15 cm)', color: '#34d399' };
    }
    if (status === 'Caution') {
      return { className: 'badge-caution', icon: AlertTriangle, label: 'CAUTION (16 - 29 cm)', color: '#fbbf24' };
    }
    return { className: 'badge-danger', icon: ShieldAlert, label: 'DANGER (30+ cm STALL HAZARD)', color: '#f87171' };
  };

  const statusConfig = result ? getStatusBadge(result.status_flag) : null;
  const StatusIcon = statusConfig ? statusConfig.icon : null;

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div className="glass-card">
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '8px', 
              background: 'rgba(6, 182, 212, 0.15)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Camera size={20} color="#38bdf8" />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>CV Water Depth Gauge</h2>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
            Upload a flooded road or vehicle photo. Our YOLOv8 model calculates water depth 
            by calibrating visible aspect ratios and tire submersion against the 65 cm physical baseline.
          </p>
        </div>

        {/* Authentication Notice Banner */}
        {!user ? (
          <div style={{
            background: '#eff6ff',
            border: '2px solid #0284c7',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '3px 3px 0px #0284c7'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Lock size={20} color="#0284c7" />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.94rem' }}>
                  Citizen Sign-In Required to Upload Imagery
                </div>
                <div style={{ color: '#475569', fontSize: '0.84rem' }}>
                  Please sign in or create an account to submit street photos for verified depth telemetry.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link 
                to="/login" 
                state={{ from: location }} 
                className="btn btn-primary"
                style={{ padding: '7px 16px', fontSize: '0.85rem' }}
              >
                <LogIn size={14} />
                <span>Sign In to Upload</span>
              </Link>
              <Link 
                to="/register" 
                className="btn btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.85rem' }}
              >
                <span>Register</span>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #16a34a',
            borderRadius: '10px',
            padding: '10px 16px',
            marginBottom: '22px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.88rem',
            color: '#15803d',
            fontWeight: 700,
            boxShadow: '2px 2px 0px #16a34a'
          }}>
            <UserCheck size={18} color="#16a34a" />
            <span>Authenticated Reporter: <strong>{user.name}</strong> ({user.role.toUpperCase()}) • Ready to upload and gauge flood depth</span>
          </div>
        )}

        {/* Upload Form */}
        <form onSubmit={handleUpload}>
          <div 
            className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ marginBottom: '20px' }}
          >
            <input 
              id="file-upload-input"
              type="file" 
              accept="image/jpeg, image/png, image/jpg" 
              onChange={(e) => handleFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <input 
              id="camera-capture-input"
              type="file" 
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFile(e.target.files[0])}
              style={{ display: 'none' }}
            />

            {previewUrl ? (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={previewUrl} 
                  alt="Upload preview" 
                  style={{ maxHeight: '280px', maxWidth: '100%', borderRadius: '8px', border: '2px solid #111111', objectFit: 'contain' }}
                />
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleDropzoneClick}
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', color: '#b91c1c' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <UploadCloud size={44} color="#0284c7" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  Capture or Upload Road Water Photo
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', margin: '14px 0 10px 0' }}>
                  <button
                    type="button"
                    onClick={handleCameraCaptureClick}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                  >
                    <Camera size={16} />
                    <span>Take Photo (Camera)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDropzoneClick}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                  >
                    <UploadCloud size={16} />
                    <span>Choose from Files</span>
                  </button>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Supports JPEG, JPG, PNG (Max 5MB) • Calibrated against 65cm car tire
                </div>
              </div>
            )}
          </div>

          {/* Location & Controls Strip */}
          <div style={{
            marginBottom: '24px',
            padding: '14px 18px',
            background: '#ffffff',
            border: '2px solid #111111',
            borderRadius: 'var(--radius-md)',
            boxShadow: '3px 3px 0px #111111'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '6px',
                  background: coords ? '#dcfce7' : '#e0f2fe',
                  border: '2px solid #111111',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <MapPin size={18} color="#111111" />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#111111' }}>
                    {coords ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>📍 {locationLabel || `Lat: ${coords.lat.toFixed(4)}, Lon: ${coords.lon.toFixed(4)}`}</span>
                        <CheckCircle2 size={15} color="#16a34a" />
                      </span>
                    ) : (
                      <span>Location Pending Detection...</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {coords ? `Exact Coordinates: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : 'Will auto-pin to your location or area'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  onClick={fetchAutoLocation}
                  disabled={locating}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  title="Re-detect current location"
                >
                  <Compass size={14} className={locating ? 'animate-spin' : ''} />
                  <span>{locating ? 'Detecting...' : 'Re-Detect GPS'}</span>
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowLocationSearch(!showLocationSearch)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                >
                  <Search size={14} />
                  <span>{showLocationSearch ? 'Close' : 'Set Landmark'}</span>
                </button>
              </div>
            </div>

            {/* Optional Manual Landmark / City Search Bar */}
            {showLocationSearch && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={manualLocationText}
                    onChange={(e) => setManualLocationText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualLocationSearch(); } }}
                    placeholder="Enter landmark or street (e.g. Sitabuldi, Nagpur or Mumbai Airport)"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '2px solid #111111',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleManualLocationSearch}
                    disabled={locating || !manualLocationText.trim()}
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    <span>Set Location</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={!file || loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Running YOLOv8 Neural Inference...</span>
              </>
            ) : (
              <>
                <Activity size={18} />
                <span>Analyze Water Depth</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Error Alert */}
        {error && (
          <div style={{
            marginTop: '20px',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertTriangle size={20} />
            <span><strong>Analysis Error:</strong> {error}</span>
          </div>
        )}

        {/* Results Dashboard */}
        {result && (
          <div style={{ marginTop: '36px', borderTop: '1px solid var(--border-glass)', paddingTop: '28px' }}>
            
            {/* High-Impact Emergency Toast / Banner (Triggered when sms_alert_sent is true) */}
            {(result.sms_alert_sent || showSmsToast) && (
              <div className="emergency-toast">
                <div className="emergency-toast-content">
                  <div style={{
                    background: '#000000',
                    borderRadius: '50%',
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <BellRing size={24} color="#facc15" />
                  </div>
                  <div>
                    <div className="emergency-toast-title">
                      Critical Depth Reached: Automated SMS Dispatched to Local Authorities
                    </div>
                    <div className="emergency-toast-subtitle">
                      Amazon SNS Emergency Alert sent to Traffic Warden hotline. Immediate road closure recommended.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <span className="alert-dispatched-badge">
                    <Check size={16} strokeWidth={3} />
                    <span>Alert Dispatched ✓</span>
                  </span>
                </div>
              </div>
            )}

            {/* Telemetry Status Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Detection Telemetry</span>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Inference Results</h3>
              </div>
              <div className={`badge ${statusConfig.className}`}>
                <StatusIcon size={16} />
                <span>{statusConfig.label}</span>
              </div>
            </div>

            {/* 4 Metric Cards Grid */}
            <div className="telemetry-grid">
              <div className={`metric-card ${result.estimated_depth_cm > 30 || result.sms_alert_sent ? 'metric-card-danger' : ''}`}>
                <div className="metric-title">Estimated Depth</div>
                <div className="metric-value" style={{ color: result.estimated_depth_cm > 30 ? '#ef4444' : statusConfig.color }}>
                  {result.estimated_depth_cm} <span style={{ fontSize: '1rem', fontWeight: 500 }}>cm</span>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-title">Tire Submerged</div>
                <div className="metric-value" style={{ color: '#38bdf8' }}>
                  {result.submerged_ratio || 0} <span style={{ fontSize: '1rem', fontWeight: 500 }}>%</span>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-title">Safety Score</div>
                <div className="metric-value" style={{ color: result.safety_score < 30 ? '#f87171' : (result.safety_score < 70 ? '#fbbf24' : '#34d399') }}>
                  {result.safety_score} <span style={{ fontSize: '1rem', fontWeight: 500 }}>/100</span>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-title">Model Confidence</div>
                <div className="metric-value" style={{ color: '#c084fc' }}>
                  {Math.round((result.confidence || 0.8) * 100)} <span style={{ fontSize: '1rem', fontWeight: 500 }}>%</span>
                </div>
              </div>
            </div>

            {/* Diagnostic Message */}
            <div style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid var(--border-glass)',
              marginBottom: '24px',
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              lineHeight: 1.5
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Impact Assessment: </strong> 
              {result.reason}
            </div>

            {/* Visual Proof Section */}
            {result.annotated_image_url && (
              <div style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: '#020617',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '20px'
              }}>
                <div style={{
                  padding: '10px 16px',
                  background: 'rgba(15, 23, 42, 0.95)',
                  borderBottom: '1px solid var(--border-glass)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem'
                }}>
                  <span style={{ fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={14} />
                    <span>Visual Proof: YOLOv8 Bounding Boxes & Calibrated Waterline</span>
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>65cm Physical Baseline</span>
                </div>
                <div style={{ padding: '8px', textAlign: 'center' }}>
                  <img 
                    src={result.annotated_image_url} 
                    alt="YOLOv8 Annotated Visual Gauge" 
                    style={{ maxWidth: '100%', maxHeight: '520px', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {/* Incident Persisted Banner */}
            {/* Incident Persisted & Live Map Pinpoint Navigation */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 22px',
              borderRadius: 'var(--radius-lg)',
              background: '#ffffff',
              border: '3px solid #111111',
              boxShadow: '6px 6px 0px #111111',
              flexWrap: 'wrap',
              gap: '14px',
              marginTop: '16px'
            }}>
              <div>
                <div style={{ color: '#111111', fontSize: '0.96rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} color="#16a34a" />
                  <span>Telemetry Logged & Pinned to Live GIS Map</span>
                </div>
                <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: '3px' }}>
                  {coords 
                    ? `Exact Coordinates: Lat ${coords.lat.toFixed(5)}, Lon ${coords.lon.toFixed(5)} ${result.incident_id ? `(ID: ${result.incident_id.slice(0, 8)})` : ''}`
                    : 'Water depth calculated. Click to locate in your area.'}
                </div>
              </div>

              {coords ? (
                <Link 
                  to={`/map?lat=${coords.lat}&lon=${coords.lon}&incident_id=${result.incident_id || ''}&highlight=true`} 
                  state={{ focusLat: coords.lat, focusLon: coords.lon, incidentId: result.incident_id }}
                  className="btn btn-emerald" 
                  style={{ padding: '12px 22px', fontSize: '0.92rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <MapPin size={18} />
                  <span>Point to Exact Coordinate on Live Map</span>
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <Link to="/map" className="btn btn-secondary" style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
                  <span>Open Live Map</span>
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Authentication Modal Dialog */}
        {showAuthModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}>
            <div style={{
              background: '#ffffff',
              border: '3px solid #111111',
              borderRadius: '12px',
              padding: '28px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '8px 8px 0px #111111',
              position: 'relative',
              textAlign: 'center'
            }}>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={20} />
              </button>

              <div style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                background: '#eff6ff',
                border: '2px solid #0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                boxShadow: '2px 2px 0px #0284c7'
              }}>
                <Lock size={28} color="#0284c7" />
              </div>

              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0' }}>
                Sign In Required to Upload
              </h3>

              <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '22px' }}>
                To verify waterlogging incident submissions and maintain accurate telemetry for municipal emergency teams, please sign in or create an account.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Link
                  to="/login"
                  state={{ from: location }}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    background: '#FFCE32',
                    color: '#111111',
                    border: '2px solid #111111',
                    justifyContent: 'center',
                    boxShadow: '3px 3px 0px #111111',
                    textDecoration: 'none'
                  }}
                >
                  <LogIn size={16} />
                  <span>Sign In with Existing Account</span>
                </Link>

                <Link
                  to="/register"
                  state={{ from: location }}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    justifyContent: 'center',
                    textDecoration: 'none'
                  }}
                >
                  <span>Create New Citizen Account</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    padding: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    marginTop: '4px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

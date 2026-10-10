import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
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
  Check
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function Analyze() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showSmsToast, setShowSmsToast] = useState(false);

  const handleFile = (selected) => {
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (err) => {
          console.error("Location error", err);
          alert("Could not retrieve GPS location. You can still analyze without GPS coordinates.");
        }
      );
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
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

        {/* Upload Form */}
        <form onSubmit={handleUpload}>
          <div 
            className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload-input').click()}
            style={{ marginBottom: '20px' }}
          >
            <input 
              id="file-upload-input"
              type="file" 
              accept="image/jpeg, image/png, image/jpg" 
              onChange={(e) => handleFile(e.target.files[0])}
              style={{ display: 'none' }}
            />

            {previewUrl ? (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={previewUrl} 
                  alt="Upload preview" 
                  style={{ maxHeight: '280px', maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-glass)' }}
                />
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#38bdf8' }}>
                  Click or drag another image to replace
                </div>
              </div>
            ) : (
              <div>
                <UploadCloud size={44} color="#38bdf8" style={{ margin: '0 auto 12px auto', display: 'block', opacity: 0.8 }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Drag & Drop street photo, or <span style={{ color: '#38bdf8', textDecoration: 'underline' }}>Browse</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Supports JPEG, JPG, PNG (Max 5MB)
                </div>
              </div>
            )}
          </div>

          {/* Location & Controls Strip */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '24px',
            padding: '12px 16px',
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)'
          }}>
            <button 
              type="button" 
              onClick={requestLocation}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.88rem' }}
            >
              <MapPin size={16} color="#38bdf8" />
              <span>Attach GPS Coordinates</span>
            </button>

            {coords ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: '#34d399', fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                <span>Lat: {coords.lat.toFixed(4)}, Lon: {coords.lon.toFixed(4)}</span>
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                GPS optional (logs to Live GIS Map)
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
            {result.incident_id && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} />
                  <span>Logged to Amazon DynamoDB (ID: {result.incident_id.slice(0, 8)}...)</span>
                </div>
                <Link to="/map" className="btn btn-emerald" style={{ padding: '8px 16px', fontSize: '0.88rem' }}>
                  <span>View on Live Map</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function Analyze() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setResult(null);
      setError(null);
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
          alert("Could not get location. You can still upload without it.");
        }
      );
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    if (coords) {
      formData.append('latitude', coords.lat);
      formData.append('longitude', coords.lon);
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/analyze`, formData);
      setResult(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'Safe') {
      return { bg: '#dcfce7', text: '#15803d', border: '#86efac', label: 'SAFE (0-15 cm)' };
    }
    if (status === 'Caution') {
      return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d', label: 'CAUTION (16-29 cm)' };
    }
    return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', label: 'DANGER (30+ cm)' };
  };

  const badge = result ? getStatusBadge(result.status_flag) : null;

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', padding: '24px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <h2 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>🌊 CV Waterlogging Depth Gauge</h2>
      <p style={{ color: '#64748b', marginTop: 0 }}>
        Upload a photo of a flooded road. Our YOLOv8 model calculates water depth in centimeters 
        by calibrating against the standard 65cm vehicle tire diameter.
      </p>
      
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Select Street / Vehicle Photo:</label>
          <input 
            type="file" 
            accept="image/jpeg, image/png, image/jpg" 
            onChange={handleFileChange}
            style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
          />
        </div>

        {previewUrl && !result && (
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <img 
              src={previewUrl} 
              alt="Preview" 
              style={{ maxHeight: '240px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
            />
          </div>
        )}
        
        <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button" 
            onClick={requestLocation} 
            style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
          >
            📍 Attach GPS Location
          </button>
          {coords ? (
            <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Lat: {coords.lat.toFixed(4)}, Lon: {coords.lon.toFixed(4)}</span>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Optional: Logs incident to Live Map</span>
          )}
        </div>

        <button 
          type="submit" 
          disabled={!file || loading}
          style={{ 
            width: '100%',
            padding: '12px 20px', 
            backgroundColor: (file && !loading) ? '#1a56db' : '#94a3b8', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: (file && !loading) ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: '1rem'
          }}
        >
          {loading ? 'Running YOLOv8 CV Inference...' : 'Analyze Water Depth'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '20px', padding: '14px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', border: '1px solid #fca5a5' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '28px', padding: '20px', border: `2px solid ${badge.border}`, backgroundColor: badge.bg, borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#0f172a' }}>Detection Telemetry</h3>
            <span style={{ 
              padding: '6px 14px', 
              borderRadius: '20px', 
              fontWeight: 'bold', 
              fontSize: '0.9rem',
              backgroundColor: 'white',
              color: badge.text,
              border: `1px solid ${badge.border}`
            }}>
              {badge.label}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'white', padding: '12px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Estimated Depth</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: badge.text }}>{result.estimated_depth_cm} cm</div>
            </div>
            <div style={{ background: 'white', padding: '12px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Tire Submerged</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#0284c7' }}>{result.submerged_ratio || 0}%</div>
            </div>
            <div style={{ background: 'white', padding: '12px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Safety Score</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#475569' }}>{result.safety_score}/100</div>
            </div>
            <div style={{ background: 'white', padding: '12px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Model Confidence</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#475569' }}>{Math.round((result.confidence || 0.8) * 100)}%</div>
            </div>
          </div>

          <p style={{ margin: '0 0 16px 0', color: '#334155', fontWeight: 500 }}>
            <strong>Analysis:</strong> {result.reason}
          </p>

          {/* Annotated Image with Computer Vision Bounding Boxes */}
          {result.annotated_image_url && (
            <div style={{ marginTop: '16px', marginBottom: '16px', background: '#0f172a', padding: '8px', borderRadius: '8px' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px', fontWeight: 600 }}>
                Visual Proof (YOLOv8 Annotated Bounding Boxes & Waterline):
              </div>
              <img 
                src={result.annotated_image_url} 
                alt="YOLOv8 Annotated Result" 
                style={{ width: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
          )}

          {result.incident_id && (
            <div style={{ marginTop: '14px', padding: '10px', background: 'white', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Incident logged to DynamoDB (ID: {result.incident_id.slice(0, 8)}...)</span>
              <Link to="/map" style={{ color: '#1a56db', fontWeight: 600, textDecoration: 'none' }}>View on Live Map →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

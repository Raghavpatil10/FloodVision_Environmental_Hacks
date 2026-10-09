import React, { useState } from 'react';
import axios from 'axios';

export default function Analyze() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);

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
      const res = await axios.post('http://localhost:8000/api/analyze', formData);
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'An error occurred during analysis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
      <h2>Analyze Flooded Road</h2>
      <p>Upload a photo of a flooded road to estimate water depth.</p>
      
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: '15px' }}>
          <input 
            type="file" 
            accept="image/jpeg, image/png" 
            onChange={(e) => setFile(e.target.files[0])}
            style={{ width: '100%', padding: '10px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <button type="button" onClick={requestLocation} style={{ padding: '8px 15px', marginRight: '10px' }}>
            Get Current Location
          </button>
          {coords && <span style={{ color: 'green' }}>✓ Location acquired</span>}
        </div>

        <button 
          type="submit" 
          disabled={!file || loading}
          style={{ padding: '10px 20px', backgroundColor: '#1a56db', color: 'white', border: 'none', borderRadius: '4px', cursor: (file && !loading) ? 'pointer' : 'not-allowed' }}
        >
          {loading ? 'Analyzing...' : 'Analyze Image'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h3>Analysis Result</h3>
          <p><strong>Estimated Depth:</strong> {result.estimated_depth_cm} cm</p>
          <p><strong>Safety Score:</strong> {result.safety_score}/100</p>
          <p><strong>Risk Level:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{result.risk_level}</span></p>
          <p><strong>Reason:</strong> {result.reason}</p>
          {result.confidence < 0.5 && (
            <p style={{ color: '#d97706' }}>Warning: The result is uncertain due to low model confidence.</p>
          )}
          {result.incident_id && (
            <p style={{ color: 'green' }}>✓ Incident reported successfully (ID: {result.incident_id})</p>
          )}
        </div>
      )}
    </div>
  );
}

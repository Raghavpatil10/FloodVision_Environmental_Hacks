import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Fix leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getMarkerColor = (risk_level) => {
  switch (risk_level) {
    case 'low': return '#10b981';
    case 'moderate': return '#f59e0b';
    case 'high': return '#f97316';
    case 'critical': return '#ef4444';
    default: return '#6b7280';
  }
};

const createCustomIcon = (color) => {
  return new L.DivIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

export default function MapDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/incidents`);
      setIncidents(res.data);
    } catch (err) {
      console.error(err);
      setError("Could not load incidents. Backend may be offline.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '80vh', border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
      {loading && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'white', padding: '10px 16px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          Loading GIS telemetry...
        </div>
      )}

      {error && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: '#fee2e2', color: '#b91c1c', padding: '10px 16px', borderRadius: '6px' }}>
          {error}
        </div>
      )}
      
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: '14px 18px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>Flood Hazard Legend</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: 12, height: 12, background: '#10b981', borderRadius: '50%' }}></div>
          <span>Safe (0-15cm)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: '50%' }}></div>
          <span>Caution (16-29cm)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: '50%' }}></div>
          <span>Danger (30+cm Stall Risk)</span>
        </div>
        <button onClick={fetchIncidents} style={{ marginTop: '6px', width: '100%', padding: '6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>
          🔄 Refresh Incidents
        </button>
      </div>

      <MapContainer center={[19.0760, 72.8777]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {incidents.map((inc) => (
          inc.latitude && inc.longitude ? (
            <Marker 
              key={inc.incident_id} 
              position={[inc.latitude, inc.longitude]}
              icon={createCustomIcon(getMarkerColor(inc.risk_level))}
            >
              <Popup>
                <div style={{ minWidth: '180px' }}>
                  <h4 style={{ margin: '0 0 6px 0', color: inc.estimated_depth_cm >= 30 ? '#b91c1c' : '#1e293b' }}>
                    {inc.status_flag ? `Status: ${inc.status_flag}` : `Risk: ${inc.risk_level}`}
                  </h4>
                  <div><strong>Depth:</strong> {inc.estimated_depth_cm} cm</div>
                  <div><strong>Safety Score:</strong> {inc.safety_score}/100</div>
                  {inc.confidence && <div><strong>Confidence:</strong> {Math.round(parseFloat(inc.confidence) * 100)}%</div>}
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                    Reported: {new Date(inc.reported_at).toLocaleTimeString()}
                  </div>
                  {inc.annotated_image_url && (
                    <div style={{ marginTop: '8px' }}>
                      <img 
                        src={inc.annotated_image_url} 
                        alt="Flood proof" 
                        style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px' }} 
                      />
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
}

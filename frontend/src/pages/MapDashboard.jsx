import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';

// Fix leaflet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getMarkerColor = (risk_level) => {
  switch (risk_level) {
    case 'low': return 'green';
    case 'moderate': return 'gold';
    case 'high': return 'orange';
    case 'critical': return 'red';
    default: return 'gray';
  }
};

const createCustomIcon = (color) => {
  return new L.DivIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

export default function MapDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8000/api/incidents');
      setIncidents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '80vh', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
      {loading && <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'white', padding: '10px', borderRadius: '4px' }}>Loading incidents...</div>}
      
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Risk Legend</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}><div style={{ width: 12, height: 12, background: 'green', borderRadius: '50%' }}></div> Low (0-5cm)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}><div style={{ width: 12, height: 12, background: 'gold', borderRadius: '50%' }}></div> Moderate (5-15cm)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}><div style={{ width: 12, height: 12, background: 'orange', borderRadius: '50%' }}></div> High (15-30cm)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}><div style={{ width: 12, height: 12, background: 'red', borderRadius: '50%' }}></div> Critical (>30cm)</div>
        <button onClick={fetchIncidents} style={{ marginTop: '10px', width: '100%', padding: '5px' }}>Refresh</button>
      </div>

      <MapContainer center={[20, 78]} zoom={4} style={{ height: '100%', width: '100%' }}>
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
                <div>
                  <strong>Depth:</strong> {inc.estimated_depth_cm} cm <br/>
                  <strong>Risk:</strong> {inc.risk_level} <br/>
                  <strong>Score:</strong> {inc.safety_score}/100 <br/>
                  <strong>Reported:</strong> {new Date(inc.reported_at).toLocaleString()}
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
}

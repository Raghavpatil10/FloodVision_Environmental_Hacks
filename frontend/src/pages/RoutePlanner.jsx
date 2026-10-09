import React, { useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Polyline, Popup, Marker } from 'react-leaflet';

export default function RoutePlanner() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper to convert comma-separated string to coords
  const parseCoords = (str) => {
    const parts = str.split(',');
    if (parts.length === 2) {
      return { lat: parseFloat(parts[0].trim()), lon: parseFloat(parts[1].trim()) };
    }
    return null;
  };

  const handlePlanRoute = async (e) => {
    e.preventDefault();
    const origCoords = parseCoords(origin);
    const destCoords = parseCoords(destination);
    
    if (!origCoords || !destCoords) {
      setError("Please enter coordinates in 'lat, lon' format.");
      return;
    }

    setLoading(true);
    setError(null);
    setRouteData(null);

    try {
      const res = await axios.post('http://localhost:8000/api/routes/plan', {
        origin: origCoords,
        destination: destCoords
      });
      setRouteData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: '80vh' }}>
      <div style={{ width: '350px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflowY: 'auto' }}>
        <h2>Safe Route Planner</h2>
        <form onSubmit={handlePlanRoute}>
          <div style={{ marginBottom: '15px' }}>
            <label>Origin (Lat, Lon):</label><br/>
            <input 
              value={origin} 
              onChange={e => setOrigin(e.target.value)} 
              placeholder="e.g. 19.0760, 72.8777" 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Destination (Lat, Lon):</label><br/>
            <input 
              value={destination} 
              onChange={e => setDestination(e.target.value)} 
              placeholder="e.g. 19.0820, 72.8810" 
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? 'Planning...' : 'Find Safe Route'}
          </button>
        </form>

        {error && <div style={{ marginTop: '15px', color: 'red' }}>{error}</div>}

        {routeData && routeData.recommended_route && (
          <div style={{ marginTop: '20px' }}>
            <h3>Recommended Route</h3>
            <div style={{ padding: '15px', border: '2px solid #059669', borderRadius: '4px', backgroundColor: '#ecfdf5' }}>
              <p><strong>Distance:</strong> {(routeData.recommended_route.total_distance_m / 1000).toFixed(2)} km</p>
              <p><strong>Duration:</strong> {Math.round(routeData.recommended_route.total_duration_s / 60)} min</p>
              <p><strong>Safety Score:</strong> {routeData.recommended_route.overall_safety_score}/100</p>
              <p><strong>Reason:</strong> {routeData.recommended_route.recommendation_reason}</p>
            </div>
            
            {routeData.alternative_routes?.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4>Alternatives</h4>
                {routeData.alternative_routes.map((alt, idx) => (
                  <div key={idx} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px' }}>
                    <p>Distance: {(alt.total_distance_m / 1000).toFixed(2)} km</p>
                    <p>Score: {alt.overall_safety_score}/100</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <MapContainer center={parseCoords(origin) ? [parseCoords(origin).lat, parseCoords(origin).lon] : [20, 78]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
          
          {/* We'd typically render the actual polyline geometry here if the routing provider returns it.
              For this implementation, since we return 'full_route' stub geometry, we just draw a line between origin and dest if they exist to show intent. 
              In production, we decode OSRM polyline. */}
          {routeData && (
             <Polyline 
               positions={[
                 [routeData.origin.lat, routeData.origin.lon], 
                 [routeData.destination.lat, routeData.destination.lon]
               ]} 
               color={routeData.recommended_route?.overall_safety_score < 50 ? 'red' : 'blue'} 
               weight={5}
             />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

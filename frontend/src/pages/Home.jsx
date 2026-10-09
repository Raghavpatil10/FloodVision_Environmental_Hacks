import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>Flood-Risk Monitoring & Safe-Route Platform</h2>
      <p style={{ fontSize: '1.2rem', color: '#4b5563', maxWidth: '800px', margin: '0 auto 40px' }}>
        Help your community by reporting flooded roads, monitor real-time flood hazards on the interactive map, 
        and find safe, unaffected routes to your destination.
      </p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <Link to="/analyze" style={{
          padding: '15px 30px', backgroundColor: '#1a56db', color: 'white', textDecoration: 'none', 
          borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem'
        }}>
          Analyze Flooded Road
        </Link>
        <Link to="/map" style={{
          padding: '15px 30px', backgroundColor: '#059669', color: 'white', textDecoration: 'none', 
          borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem'
        }}>
          Open Live Flood Map
        </Link>
        <Link to="/routes" style={{
          padding: '15px 30px', backgroundColor: '#7c3aed', color: 'white', textDecoration: 'none', 
          borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem'
        }}>
          Route Planner
        </Link>
      </div>
    </div>
  );
}

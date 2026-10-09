import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Analyze from './pages/Analyze';
import MapDashboard from './pages/MapDashboard';
import RoutePlanner from './pages/RoutePlanner';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #ccc' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#1a56db' }}>
            <h1 style={{ margin: 0 }}>🌊 FloodVision</h1>
          </Link>
          <nav style={{ display: 'flex', gap: '15px' }}>
            <Link to="/analyze" style={{ textDecoration: 'none', color: '#374151' }}>Analyze</Link>
            <Link to="/map" style={{ textDecoration: 'none', color: '#374151' }}>Live Map</Link>
            <Link to="/routes" style={{ textDecoration: 'none', color: '#374151' }}>Safe Routes</Link>
          </nav>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/map" element={<MapDashboard />} />
            <Route path="/routes" element={<RoutePlanner />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

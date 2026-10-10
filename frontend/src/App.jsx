import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Waves, Camera, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import Home from './pages/Home';
import Analyze from './pages/Analyze';
import MapDashboard from './pages/MapDashboard';
import RoutePlanner from './pages/RoutePlanner';

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Modern Sticky Navigation */}
        <header className="navbar">
          <div className="navbar-container">
            <Link to="/" className="brand-link">
              <div className="brand-logo-icon">
                <Waves size={22} color="#ffffff" strokeWidth={2.5} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="brand-title">FloodVision</span>
                <span className="brand-tag">YOLOv8</span>
              </div>
            </Link>

            <nav className="nav-links">
              <NavLink 
                to="/analyze" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Camera size={16} />
                <span>Gauge Depth</span>
              </NavLink>

              <NavLink 
                to="/map" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <MapPin size={16} />
                <span>Live Map</span>
              </NavLink>

              <NavLink 
                to="/routes" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Navigation size={16} />
                <span>Safe Routes</span>
              </NavLink>
            </nav>

            <div className="system-status-pill">
              <span className="status-pulse-dot"></span>
              <span>Inference Engine Live</span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/map" element={<MapDashboard />} />
            <Route path="/routes" element={<RoutePlanner />} />
          </Routes>
        </main>

        {/* Modern Footer */}
        <footer className="app-footer">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldCheck size={16} color="#06b6d4" />
            <span>Built for Environmental Hacks 2026 | Track 02: Heat & Water</span>
          </div>
          <div>Computer Vision Waterlogging Gauge & Edge-Calibrated Depth Analytics</div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;

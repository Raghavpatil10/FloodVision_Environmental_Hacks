import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { Waves, Camera, MapPin, Navigation, ShieldCheck, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Analyze from './pages/Analyze';
import MapDashboard from './pages/MapDashboard';
import RoutePlanner from './pages/RoutePlanner';
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import RegionalUpload from './pages/RegionalUpload';
import AccessDenied from './pages/AccessDenied';
import ProtectedRoute from './components/ProtectedRoute';

function NavbarAuth() {
  const { user, logout } = useAuth();

  if (user) {
    const isAnyAdmin = user.role === 'admin' || user.role === 'superadmin';
    const dashboardPath = isAnyAdmin ? '/admin/dashboard' : '/user/dashboard';
    const badgeColor = user.role === 'superadmin' ? '#9333ea' : (user.role === 'admin' ? '#ef4444' : '#10b981');

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          to={dashboardPath}
          title="Open Dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: '#111111',
            background: '#ffffff',
            border: '2px solid #111111',
            borderRadius: '20px',
            padding: '5px 12px',
            boxShadow: '2px 2px 0px #111111',
            fontSize: '0.82rem',
            fontWeight: 800
          }}
        >
          <LayoutDashboard size={14} color="#0284c7" />
          <span>{user.name.split(' ')[0]}</span>
          <span style={{
            background: badgeColor,
            color: '#ffffff',
            padding: '1px 6px',
            borderRadius: '10px',
            fontSize: '0.68rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {user.role}
          </span>
        </Link>
        <button
          onClick={logout}
          title="Sign Out"
          style={{
            background: '#ffffff',
            border: '2px solid #111111',
            borderRadius: '8px',
            padding: '6px 10px',
            cursor: 'pointer',
            boxShadow: '2px 2px 0px #111111',
            display: 'flex',
            alignItems: 'center',
            color: '#111111'
          }}
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/login"
      className="btn"
      style={{
        padding: '6px 14px',
        fontSize: '0.84rem',
        fontWeight: 800,
        background: '#FFCE32',
        color: '#111111',
        textDecoration: 'none',
        border: '2px solid #111111',
        boxShadow: '2px 2px 0px #111111'
      }}
    >
      <LogIn size={14} />
      <span>Sign In</span>
    </Link>
  );
}

function App() {
  return (
    <AuthProvider>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <NavbarAuth />
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/access-denied" element={<AccessDenied />} />
              <Route path="/map" element={<MapDashboard />} />
              <Route path="/routes" element={<RoutePlanner />} />
              
              {/* Tool Route */}
              <Route path="/analyze" element={<Analyze />} />

              {/* Protected User Dashboard */}
              <Route 
                path="/user/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['user', 'admin', 'superadmin']}>
                    <UserDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Regional Admin Dashboard */}
              <Route 
                path="/admin/dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />

              {/* Protected Regional Image Upload Form */}
              <Route 
                path="/admin/upload" 
                element={
                  <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                    <RegionalUpload />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>

          {/* Modern Footer */}
          <footer className="app-footer">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <ShieldCheck size={16} color="#06b6d4" />
              <span>Built for Environmental Hacks 2026 | Track 02: Heat & Water</span>
            </div>
            <div>Computer Vision Waterlogging Gauge & Regional Spatial Flood Management</div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

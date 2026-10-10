import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Camera, 
  MapPin, 
  Navigation, 
  LogOut, 
  CheckCircle2, 
  Waves,
  ShieldCheck,
  Calendar
} from 'lucide-react';

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ maxWidth: '840px', margin: '30px auto 60px auto', padding: '0 16px' }}>
      
      {/* User Welcome Card */}
      <div className="glass-card" style={{ marginBottom: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              background: '#4ADE80',
              border: '2px solid #111111',
              boxShadow: '3px 3px 0px #111111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User size={28} color="#111111" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                  Welcome, {user?.name}
                </h2>
                <span style={{
                  background: '#dcfce7',
                  color: '#166534',
                  border: '1.5px solid #166534',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  Citizen Reporter
                </span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '3px' }}>
                {user?.email} • Account verified
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Account Info Pill */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '8px',
        background: '#eff6ff',
        border: '2px solid #38bdf8',
        boxShadow: '3px 3px 0px #38bdf8',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.88rem',
        color: '#0369a1'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} />
          <span><strong>Role Verified:</strong> Citizen account authenticated with active session cookie.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#0284c7' }}>
          <Calendar size={14} />
          <span>Joined: {new Date(user?.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Citizen Operations Menu
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <Link 
          to="/analyze" 
          className="glass-card glass-card-hover"
          style={{ textDecoration: 'none', color: 'inherit', padding: '24px 20px', border: '3px solid #111111' }}
        >
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '10px',
            background: '#FFCE32',
            border: '2px solid #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <Camera size={22} color="#111111" />
          </div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800 }}>
            Gauge Water Depth
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
            Upload a photo of flooded streets for instant YOLOv8 depth estimation.
          </p>
        </Link>

        <Link 
          to="/map" 
          className="glass-card glass-card-hover"
          style={{ textDecoration: 'none', color: 'inherit', padding: '24px 20px', border: '3px solid #111111' }}
        >
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '10px',
            background: '#38bdf8',
            border: '2px solid #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <MapPin size={22} color="#111111" />
          </div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800 }}>
            Live Hazard Map
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
            Explore crowd-reported floodwater depths and active beacon warnings.
          </p>
        </Link>

        <Link 
          to="/routes" 
          className="glass-card glass-card-hover"
          style={{ textDecoration: 'none', color: 'inherit', padding: '24px 20px', border: '3px solid #111111' }}
        >
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '10px',
            background: '#E96894',
            border: '2px solid #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px'
          }}>
            <Navigation size={22} color="#111111" />
          </div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800 }}>
            Safe Route Planner
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
            Calculate bypass routes that avoid waterlogged streets exceeding 30cm stall depth.
          </p>
        </Link>
      </div>

    </div>
  );
}

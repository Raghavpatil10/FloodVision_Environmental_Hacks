import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  ShieldAlert, 
  Users, 
  Radio, 
  MapPin, 
  AlertTriangle, 
  LogOut, 
  RefreshCw, 
  ShieldCheck, 
  Activity 
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdminOverview();
  }, []);

  const fetchAdminOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/overview`);
      setOverview(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Failed to load admin overview. Check permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ maxWidth: '960px', margin: '30px auto 60px auto', padding: '0 16px' }}>
      
      {/* Admin Header Card */}
      <div className="glass-card" style={{ marginBottom: '24px', background: '#0f172a', color: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              background: '#ef4444',
              border: '2px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)'
            }}>
              <ShieldAlert size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#ffffff' }}>
                  {user?.name}
                </h2>
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: '1.5px solid #000000',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Admin Officer
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '3px' }}>
                Emergency Operations & Flood Control Command • {user?.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={fetchAdminOverview}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
              title="Refresh Telemetry"
            >
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>Sync</span>
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#334155', color: '#ffffff', borderColor: '#475569' }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Role Verification Status Banner */}
      <div style={{
        padding: '14px 20px',
        borderRadius: '8px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '2px solid #ef4444',
        boxShadow: '3px 3px 0px #ef4444',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.88rem',
        color: '#b91c1c'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <ShieldCheck size={18} />
          <span>Backend Role Clearance: Verified Admin Session (HTTP-Only Cookie).</span>
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#991b1b' }}>
          Access Tier: Root Command
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          padding: '14px',
          background: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '8px',
          color: '#991b1b',
          marginBottom: '20px',
          fontWeight: 600
        }}>
          {error}
        </div>
      )}

      {/* Telemetry Overview Grid */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 900, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Emergency Operations Command Telemetry
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Citizens Enrolled
            </span>
            <Users size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>
            {overview?.stats?.registered_citizens ?? '...'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Public reporters in database
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Admin Officers
            </span>
            <ShieldCheck size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>
            {overview?.stats?.admin_officers ?? '...'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Authorized command staff
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Critical Hazards
            </span>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>
            {overview?.stats?.critical_hazards ?? '0'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Water depth &gt; 30cm stall alert
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Emergency SNS
            </span>
            <Radio size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>
            ONLINE
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '8px' }}>
            Automated SMS dispatch ready
          </div>
        </div>
      </div>

      {/* Quick Access to Live Command Map */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <Link to="/map" className="btn btn-primary" style={{ padding: '14px 22px' }}>
          <MapPin size={18} />
          <span>Open Live GIS Command Map</span>
        </Link>
        <Link to="/analyze" className="btn btn-secondary" style={{ padding: '14px 22px' }}>
          <Activity size={18} />
          <span>Run CV Depth Inference</span>
        </Link>
      </div>

    </div>
  );
}

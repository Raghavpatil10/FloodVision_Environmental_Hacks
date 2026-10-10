import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  ArrowLeft, 
  LogOut, 
  Waves,
  AlertOctagon,
  Lock
} from 'lucide-react';

export default function AccessDenied() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ maxWidth: '620px', margin: '50px auto 70px auto', padding: '0 16px' }}>
      
      {/* Brand Badge */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: 54,
          height: 54,
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '3px solid #111111',
          boxShadow: '4px 4px 0px #111111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto'
        }}>
          <Waves size={28} color="#38bdf8" strokeWidth={2.5} />
        </div>
        <h1 style={{ margin: '0 0 4px 0', fontSize: '1.9rem', fontWeight: 900, color: '#0f172a' }}>
          FloodVision Command Security
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>
          Role-Based Authorization & Incident Area Lockdown
        </p>
      </div>

      {/* Main Alert Card */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '36px 30px', 
          background: '#ffffff', 
          border: '3px solid #ef4444', 
          boxShadow: '8px 8px 0px #ef4444',
          textAlign: 'center' 
        }}
      >
        <div style={{
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
          border: '3px solid #ef4444'
        }}>
          <ShieldAlert size={36} color="#ef4444" />
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#fee2e2',
          color: '#991b1b',
          border: '2px solid #ef4444',
          borderRadius: '20px',
          padding: '3px 12px',
          fontSize: '0.78rem',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '14px'
        }}>
          <AlertOctagon size={14} />
          <span>403 — Clearance Denied</span>
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>
          Restricted Command Area
        </h2>

        <p style={{ color: '#475569', fontSize: '0.94rem', lineHeight: 1.6, marginBottom: '24px' }}>
          You do not hold the required clearance level to access this administrative portal. 
          Emergency Command procedures restrict administrative views to verified operations staff.
        </p>

        {/* User Identity Details Pill */}
        {user ? (
          <div style={{
            background: '#f8fafc',
            border: '2px solid #cbd5e1',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '28px',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                Current Authenticated Identity
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {user.name} <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.85rem' }}>({user.email})</span>
              </div>
            </div>

            <div style={{
              background: user.role === 'admin' ? '#ef4444' : '#10b981',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Assigned Role: {user.role}
            </div>
          </div>
        ) : (
          <div style={{
            background: '#f8fafc',
            border: '2px solid #cbd5e1',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '28px',
            color: '#64748b',
            fontSize: '0.88rem'
          }}>
            No active session detected. Please sign in to authenticate.
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <>
              <Link 
                to={user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard'} 
                className="btn btn-primary"
                style={{ padding: '12px 20px', fontSize: '0.92rem' }}
              >
                <ArrowLeft size={16} />
                <span>Return to Your Dashboard</span>
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '12px 20px', fontSize: '0.92rem' }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <Link 
              to="/login" 
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.92rem' }}
            >
              <Lock size={16} />
              <span>Go to Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

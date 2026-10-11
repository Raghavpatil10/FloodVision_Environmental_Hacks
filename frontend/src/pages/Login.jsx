import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Waves, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  Info, 
  X 
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState(null);

  // If already logged in, redirect based on role
  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/user/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please provide both email address and password.');
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login(cleanEmail, password, rememberMe);
      
      // Determine destination: honor intended redirect if permitted, else route by role
      const intended = location.state?.from?.pathname;
      if (intended && !intended.startsWith('/login') && !intended.startsWith('/register')) {
        if (intended.startsWith('/admin') && loggedInUser.role !== 'admin') {
          navigate('/user/dashboard', { replace: true });
        } else {
          navigate(intended, { replace: true });
        }
      } else {
        if (loggedInUser.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/user/dashboard', { replace: true });
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setForgotStatus(
      "Password recovery request noted. In compliance with emergency response protocols, please contact the Chief Flood Incident Administrator or system supervisor to verify credentials."
    );
  };

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto 60px auto', padding: '0 16px' }}>
      
      {/* Brand & Mission Banner */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: 58,
          height: 58,
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '3px solid #111111',
          boxShadow: '4px 4px 0px #111111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto'
        }}>
          <Waves size={32} color="#38bdf8" strokeWidth={2.5} />
        </div>
        
        <h1 style={{ margin: '0 0 6px 0', fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>
          FloodVision
        </h1>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px',
          background: '#0ea5e9', 
          color: '#ffffff', 
          border: '2px solid #111111', 
          borderRadius: '20px', 
          padding: '3px 12px', 
          fontSize: '0.8rem', 
          fontWeight: 800, 
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          boxShadow: '2px 2px 0px #111111',
          marginBottom: '10px'
        }}>
          <ShieldCheck size={14} />
          <span>Detect. Alert. Protect.</span>
        </div>
        <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', fontWeight: 600 }}>
          AI-powered waterlogging detection and flood risk monitoring.
        </p>
      </div>

      {/* Main Login Card */}
      <div className="glass-card" style={{ padding: '32px 30px', background: '#ffffff', border: '3px solid #111111', boxShadow: '8px 8px 0px #111111' }}>
        <div style={{ marginBottom: '22px' }}>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
            Portal Sign In
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
            Enter your credentials to access your monitoring dashboard.
          </p>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '6px',
            padding: '12px 14px',
            marginBottom: '20px',
            color: '#991b1b',
            fontSize: '0.88rem',
            fontWeight: 600
          }}>
            <AlertCircle size={18} color="#b91c1c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', color: '#0f172a' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@agency.gov or name@domain.com"
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  outline: 'none',
                  boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.05)'
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f172a' }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => { setShowForgotModal(true); setForgotStatus(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#0284c7',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '12px 44px 12px 42px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  outline: 'none',
                  boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.05)'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                accentColor: '#0ea5e9',
                cursor: 'pointer'
              }}
            />
            <label htmlFor="rememberMe" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              Remember this device for 7 days
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 800,
              background: '#FFCE32',
              color: '#111111',
              border: '3px solid #111111',
              boxShadow: '4px 4px 0px #111111'
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Authenticating Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to FloodVision</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Registration Link Footer */}
        <div style={{
          marginTop: '26px',
          paddingTop: '20px',
          borderTop: '2px dashed #cbd5e1',
          textAlign: 'center',
          fontSize: '0.92rem',
          color: '#475569'
        }}>
          Don't have an account yet?{' '}
          <Link
            to="/register"
            style={{
              color: '#0284c7',
              fontWeight: 800,
              textDecoration: 'none',
              borderBottom: '2px solid #0284c7'
            }}
          >
            Create Citizen Account
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '3px solid #111111',
            borderRadius: '12px',
            padding: '28px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '8px 8px 0px #111111',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowForgotModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(14, 165, 233, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Info size={20} color="#0284c7" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Password Recovery
              </h3>
            </div>

            {forgotStatus ? (
              <div>
                <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '20px' }}>
                  {forgotStatus}
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px' }}
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <p style={{ color: '#475569', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '16px' }}>
                  Enter your registered email address to trigger a verification notification to administrative ops.
                </p>
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '0.95rem',
                      border: '2px solid #111111',
                      borderRadius: '6px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '10px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '10px' }}
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

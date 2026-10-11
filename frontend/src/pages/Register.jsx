import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Waves, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck 
} from 'lucide-react';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If already logged in, redirect
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

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setError('Please fill in all required registration fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long for account security.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain both letters and numbers for account security.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password entries.');
      return;
    }

    setLoading(true);
    try {
      // Public registration is strictly locked to normal user role on frontend & backend
      await register(cleanName, cleanEmail, password, confirmPassword);
      navigate('/user/dashboard', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || 'Registration could not be completed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '540px', margin: '40px auto 60px auto', padding: '0 16px' }}>
      
      {/* Header */}
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
          background: '#10b981', 
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
          <span>Citizen Portal Access</span>
        </div>
        <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', fontWeight: 600 }}>
          Create your account to report flooded streets and monitor localized flood hazards.
        </p>
      </div>

      {/* Main Registration Card */}
      <div className="glass-card" style={{ padding: '32px 30px', background: '#ffffff', border: '3px solid #111111', boxShadow: '8px 8px 0px #111111' }}>
        <div style={{ marginBottom: '22px' }}>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
            Create Citizen Account
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
            Enter your details below. All public accounts are provisioned with citizen reporter access.
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', color: '#0f172a' }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <User size={18} />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Citizen"
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

          {/* Email Address */}
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
                placeholder="name@domain.com"
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

          {/* Password */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', color: '#0f172a' }}>
              Password (min. 8 characters)
            </label>
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
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', color: '#0f172a' }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
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
              background: '#4ADE80',
              color: '#111111',
              border: '3px solid #111111',
              boxShadow: '4px 4px 0px #111111'
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Registering Account...</span>
              </>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Existing account link */}
        <div style={{
          marginTop: '26px',
          paddingTop: '20px',
          borderTop: '2px dashed #cbd5e1',
          textAlign: 'center',
          fontSize: '0.92rem',
          color: '#475569'
        }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: '#0284c7',
              fontWeight: 800,
              textDecoration: 'none',
              borderBottom: '2px solid #0284c7'
            }}
          >
            Sign In Here
          </Link>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Camera,
  MapPin,
  Navigation,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Send,
  RefreshCw,
  MailCheck,
  FileText,
  AlertTriangle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function UserDashboard() {
  const { user, logout, verifyEmail } = useAuth();
  const navigate = useNavigate();

  // Admin Request form state
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [requestSuccess, setRequestSuccess] = useState(null);

  // Email verification state
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null);

  // Application history
  const [myRequests, setMyRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyRequests();
    }
  }, [user]);

  const fetchMyRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin-requests/me`);
      setMyRequests(res.data.requests || []);
    } catch (err) {
      console.warn("Could not load user requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleVerifyEmail = async () => {
    setVerifyingEmail(true);
    setVerifyStatus(null);
    try {
      await verifyEmail();
      setVerifyStatus({
        type: 'success',
        text: 'Email verified successfully! You can now request emergency administrator access.'
      });
    } catch (err) {
      setVerifyStatus({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to verify email address.'
      });
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    const cleanReason = reason.trim();
    if (cleanReason.length < 10) {
      setRequestError("Please provide a detailed justification (minimum 10 characters).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin-requests`, {
        reason: cleanReason
      });
      setRequestSuccess(res.data.message || "Application submitted successfully!");
      setReason('');
      fetchMyRequests();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setRequestError(detail || "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Check if there is currently a pending application
  const pendingRequest = myRequests.find(r => r.status === 'pending');
  const hasApprovedRequest = myRequests.some(r => r.status === 'approved');
  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ maxWidth: '880px', margin: '30px auto 60px auto', padding: '0 16px' }}>

      {/* User Welcome Card */}
      <div className="glass-card" style={{ marginBottom: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              background: isAdmin ? '#ef4444' : '#4ADE80',
              border: '2px solid #111111',
              boxShadow: '3px 3px 0px #111111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isAdmin ? <ShieldCheck size={28} color="#ffffff" /> : <User size={28} color="#111111" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                  Welcome, {user?.name}
                </h2>
                <span style={{
                  background: isAdmin ? '#fee2e2' : '#dcfce7',
                  color: isAdmin ? '#b91c1c' : '#166534',
                  border: `1.5px solid ${isAdmin ? '#b91c1c' : '#166534'}`,
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  {isAdmin ? 'Administrator' : 'Citizen Reporter'}
                </span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{user?.email}</span>
                <span>•</span>
                {user?.email_verified ? (
                  <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle2 size={13} /> Email Verified
                  </span>
                ) : (
                  <span style={{ color: '#eab308', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <AlertTriangle size={13} /> Unverified Email
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isAdmin && (
              <Link
                to="/admin/dashboard"
                className="btn btn-primary"
                style={{ padding: '8px 14px', fontSize: '0.84rem', background: '#ef4444', color: '#ffffff' }}
              >
                <ShieldCheck size={14} />
                <span>Admin Dashboard</span>
              </Link>
            )}
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
      </div>

      {/* Email Verification Banner (if unverified) */}
      {!user?.email_verified && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '8px',
          background: '#fffbeb',
          border: '2px solid #f59e0b',
          boxShadow: '3px 3px 0px #f59e0b',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          color: '#92400e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', fontSize: '0.92rem' }}>Email Verification Pending</strong>
              <span style={{ fontSize: '0.84rem' }}>
                Verify your email address to enable emergency administrator applications.
              </span>
            </div>
          </div>
          <button
            onClick={handleVerifyEmail}
            disabled={verifyingEmail}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              background: '#f59e0b',
              color: '#ffffff',
              border: '2px solid #111111',
              boxShadow: '2px 2px 0px #111111'
            }}
          >
            {verifyingEmail ? (
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <MailCheck size={14} />
            )}
            <span>Verify Email Now</span>
          </button>
        </div>
      )}

      {/* Verification status feedback */}
      {verifyStatus && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: verifyStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `2px solid ${verifyStatus.type === 'success' ? '#22c55e' : '#ef4444'}`,
          marginBottom: '20px',
          fontSize: '0.88rem',
          color: verifyStatus.type === 'success' ? '#15803d' : '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {verifyStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{verifyStatus.text}</span>
        </div>
      )}

      {/* Account Info Pill */}
      <div style={{
        padding: '14px 20px',
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
          <span><strong>Security Clearance:</strong> Authenticated session active. Role: {user?.role.toUpperCase()}.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#0284c7' }}>
          <Calendar size={14} />
          <span>Member since {new Date(user?.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* SECTION 4: Request Admin Access Workflow */}
      <div className="glass-card" style={{ marginBottom: '32px', padding: '28px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            background: '#0ea5e9',
            border: '2px solid #111111',
            boxShadow: '2px 2px 0px #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={22} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
              Municipal Administrator Access
            </h3>
            <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              Traffic wardens and municipal responders can request administrative clearance to access the triage dashboard.
            </p>
          </div>
        </div>

        {/* Existing Admin notice */}
        {isAdmin ? (
          <div style={{
            padding: '14px 18px',
            background: '#f0fdf4',
            border: '2px solid #22c55e',
            borderRadius: '8px',
            color: '#15803d',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={20} color="#16a34a" />
            <div>
              <strong>Administrator Clearance Active:</strong> Your account is authorized to review incident reports and approve access requests.
            </div>
          </div>
        ) : pendingRequest ? (
          /* Pending Application Notification */
          <div style={{
            padding: '16px 20px',
            background: '#fffbeb',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            color: '#92400e',
            fontSize: '0.9rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, marginBottom: '6px' }}>
              <Clock size={18} color="#d97706" />
              <span>Application Under Municipal Review</span>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#78350f' }}>
              You submitted an application on {new Date(pendingRequest.created_at).toLocaleString()}. You cannot submit duplicate applications while one is pending review.
            </p>
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '0.84rem',
              fontStyle: 'italic',
              color: '#451a03'
            }}>
              "{pendingRequest.reason}"
            </div>
          </div>
        ) : (
          /* Application Form */
          <div>
            {requestError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                background: '#fee2e2',
                border: '2px solid #ef4444',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '0.88rem',
                marginBottom: '16px',
                fontWeight: 600
              }}>
                <AlertCircle size={18} color="#b91c1c" />
                <span>{requestError}</span>
              </div>
            )}

            {requestSuccess && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                background: '#f0fdf4',
                border: '2px solid #22c55e',
                borderRadius: '6px',
                color: '#15803d',
                fontSize: '0.88rem',
                marginBottom: '16px',
                fontWeight: 600
              }}>
                <CheckCircle2 size={18} color="#16a34a" />
                <span>{requestSuccess}</span>
              </div>
            )}

            {!user?.email_verified ? (
              <div style={{
                padding: '14px 16px',
                background: '#f8fafc',
                border: '2px dashed #94a3b8',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.88rem'
              }}>
                Please verify your email address above before submitting an administrator access request.
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', color: '#0f172a' }}>
                    Reason for Requesting Administrator Access
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe your role (e.g. Traffic Warden District 4, Emergency Response Coordinator) and why you need access to the protected municipal triage dashboard..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.92rem',
                      fontWeight: 500,
                      border: '2px solid #111111',
                      borderRadius: '6px',
                      background: '#f8fafc',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    <span>Minimum 10 characters required.</span>
                    <span>{reason.length} / 1000 characters</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || reason.trim().length < 10}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 20px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    background: '#0ea5e9',
                    color: '#ffffff',
                    border: '2px solid #111111',
                    boxShadow: '3px 3px 0px #111111'
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Submitting Application...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Submit Admin Access Application</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Application History Table */}
        {myRequests.length > 0 && (
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px dashed #e2e8f0' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Your Application History
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111111', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Date</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Reason</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Status</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Review Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((req) => (
                    <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 12px', maxWidth: '300px', color: '#1e293b' }}>
                        {req.reason}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                          color: req.status === 'approved' ? '#166534' : req.status === 'rejected' ? '#991b1b' : '#92400e',
                          border: `1px solid ${req.status === 'approved' ? '#86efac' : req.status === 'rejected' ? '#fca5a5' : '#fde68a'}`
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontStyle: req.review_note ? 'italic' : 'normal' }}>
                        {req.review_note || (req.status === 'pending' ? 'Pending review by municipal admin' : 'None')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

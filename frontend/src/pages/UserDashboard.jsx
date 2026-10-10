import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';
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
  Calendar,
  Send,
  RefreshCw,
  MailCheck,
  FileText,
  AlertTriangle,
  Building,
  Briefcase,
  Mail,
  Compass,
  Link as LinkIcon
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function UserDashboard() {
  const { user, logout, verifyEmail } = useAuth();
  const navigate = useNavigate();

  // Admin Request form state
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    organization: '',
    designation: '',
    officialEmail: '',
    requestedRegion: '',
    reason: '',
    supportingEvidence: ''
  });

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
      setFormData(prev => ({ ...prev, fullName: user.name || '' }));
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    const cleanReason = formData.reason.trim();
    if (cleanReason.length < 10) {
      setRequestError("Please provide a detailed justification (minimum 10 characters).");
      return;
    }

    if (!formData.organization.trim()) {
      setRequestError("Please specify your organization or department.");
      return;
    }

    if (!formData.requestedRegion.trim()) {
      setRequestError("Please specify the requested region, city, or geographic area.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin-requests`, {
        reason: cleanReason,
        organization: formData.organization.trim(),
        designation: formData.designation.trim(),
        official_email: formData.officialEmail.trim() || null,
        requested_region: formData.requestedRegion.trim(),
        supporting_evidence: formData.supportingEvidence.trim() || null
      });
      setRequestSuccess(res.data.message || "Application submitted successfully! It is now pending superadmin review.");
      setFormData({
        fullName: user?.name || '',
        organization: '',
        designation: '',
        officialEmail: '',
        requestedRegion: '',
        reason: '',
        supportingEvidence: ''
      });
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

  const pendingRequest = myRequests.find(r => r.status === 'pending');
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <div style={{ maxWidth: '880px', margin: '30px auto 60px auto', padding: '0 16px' }}>
      
      {/* Top Left Theme-Consistent Back Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
        <BackButton to="/" label="Back to Home" />
      </div>

      {/* User Welcome Card */}
      <div className="glass-card" style={{ marginBottom: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              background: user?.role === 'superadmin' ? '#9333ea' : (isAdmin ? '#ef4444' : '#4ADE80'),
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
                  background: user?.role === 'superadmin' ? '#f3e8ff' : (isAdmin ? '#fee2e2' : '#dcfce7'),
                  color: user?.role === 'superadmin' ? '#7e22ce' : (isAdmin ? '#b91c1c' : '#166534'),
                  border: `1.5px solid ${user?.role === 'superadmin' ? '#7e22ce' : (isAdmin ? '#b91c1c' : '#166534')}`,
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase'
                }}>
                  {user?.role}
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

      {/* SECTION: Request Admin Access Workflow */}
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
              Request Regional Administrator Access
            </h3>
            <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              Traffic wardens, emergency responders, and civic officers can request administrative clearance for an assigned geographic sector.
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
              <strong>Administrator Clearance Active:</strong> Your account is authorized as a Regional Administrator. You can upload and manage flood images in your assigned geographic region.
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
              <span>Application Under Superadmin Review</span>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#78350f' }}>
              You submitted an application on {new Date(pendingRequest.created_at).toLocaleString()} for region <strong>"{pendingRequest.requested_region || 'Unspecified'}"</strong>. You cannot submit duplicate applications while one is pending review.
            </p>
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '10px 14px',
              fontSize: '0.84rem',
              color: '#451a03'
            }}>
              <div><strong>Organization:</strong> {pendingRequest.organization || 'N/A'} ({pendingRequest.designation || 'N/A'})</div>
              <div style={{ marginTop: '4px' }}><strong>Reason:</strong> "{pendingRequest.reason}"</div>
            </div>
          </div>
        ) : (
          /* Comprehensive Application Form */
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  {/* Full Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={formData.fullName}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '2px solid #111111',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        background: '#f8fafc'
                      }}
                    />
                  </div>

                  {/* Organization */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                      Organization / Department *
                    </label>
                    <input
                      type="text"
                      name="organization"
                      required
                      placeholder="e.g. City Traffic Police, Municipal Disaster Mgmt"
                      value={formData.organization}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '2px solid #111111',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        background: '#ffffff'
                      }}
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                      Designation / Role
                    </label>
                    <input
                      type="text"
                      name="designation"
                      placeholder="e.g. Chief Warden, Area Inspector"
                      value={formData.designation}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '2px solid #111111',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        background: '#ffffff'
                      }}
                    />
                  </div>

                  {/* Official Email */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                      Official Email (if applicable)
                    </label>
                    <input
                      type="email"
                      name="officialEmail"
                      placeholder="e.g. officer@citygov.gov.in"
                      value={formData.officialEmail}
                      onChange={handleChange}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '2px solid #111111',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        background: '#ffffff'
                      }}
                    />
                  </div>
                </div>

                {/* Requested Region */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                    Requested Region / Locality / Sector *
                  </label>
                  <input
                    type="text"
                    name="requestedRegion"
                    required
                    placeholder="e.g. Bangalore South - Koramangala & HSR Ward"
                    value={formData.requestedRegion}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: '2px solid #111111',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      background: '#ffffff'
                    }}
                  />
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    The superadmin will assign an exact circular or polygonal geographic boundary based on this region.
                  </span>
                </div>

                {/* Reason */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                    Reason for Requesting Administrator Access *
                  </label>
                  <textarea
                    required
                    rows={3}
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    placeholder="Describe your jurisdiction and emergency responsibilities for floodwater management in this region..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontFamily: 'inherit',
                      fontSize: '0.9rem',
                      border: '2px solid #111111',
                      borderRadius: '6px',
                      background: '#ffffff',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    <span>Minimum 10 characters required.</span>
                    <span>{formData.reason.length} / 1000 characters</span>
                  </div>
                </div>

                {/* Supporting Authorization Evidence */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', color: '#0f172a' }}>
                    Supporting Authorization Evidence / ID Verification Link
                  </label>
                  <input
                    type="text"
                    name="supportingEvidence"
                    placeholder="e.g. Officer Badge #, Municipal portal verification link, or departmental reference"
                    value={formData.supportingEvidence}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: '2px solid #111111',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      background: '#ffffff'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || formData.reason.trim().length < 10 || !formData.organization.trim() || !formData.requestedRegion.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 22px',
                    fontSize: '0.92rem',
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
                      <span>Submit Regional Admin Request</span>
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
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Requested Region</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Organization</th>
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
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                        {req.requested_region || 'Standard Sector'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        {req.organization ? `${req.organization} (${req.designation || 'Staff'})` : 'Individual'}
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
                        {req.review_note || (req.status === 'pending' ? 'Pending superadmin review' : 'No notes provided')}
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

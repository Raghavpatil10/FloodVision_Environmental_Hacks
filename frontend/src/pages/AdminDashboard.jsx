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
  Activity,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Shield,
  MessageSquare,
  Compass,
  Eye,
  CheckSquare,
  CornerDownRight,
  Maximize2,
  Layers,
  ArrowRight
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Main Tabs: 'issues' (Assigned Regional Incidents), 'applications', 'audit'
  const [mainTab, setMainTab] = useState('issues');

  // Regional Incidents State
  const [regionalData, setRegionalData] = useState(null);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('all'); // 'all', 'active', 'resolved'
  const [resolvingId, setResolvingId] = useState(null);
  const [incidentFeedback, setIncidentFeedback] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Applications tab state
  const [appSubTab, setAppSubTab] = useState('pending'); // 'pending', 'history'
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Confirmation Modal state for Application Reviews
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
  const [reviewNote, setReviewNote] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  useEffect(() => {
    fetchAdminOverview();
    fetchRegionalIncidents();
    fetchApplications();
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

  const fetchRegionalIncidents = async () => {
    setLoadingIncidents(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/incidents`);
      setRegionalData(res.data);
    } catch (err) {
      console.warn("Could not load regional incidents:", err);
    } finally {
      setLoadingIncidents(false);
    }
  };

  const fetchApplications = async () => {
    setLoadingApps(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin-requests`);
      setApplications(res.data.requests || []);
    } catch (err) {
      console.warn("Could not load applications:", err);
    } finally {
      setLoadingApps(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/audit-logs?limit=40`);
      setAuditLogs(res.data.logs || []);
    } catch (err) {
      console.warn("Could not load audit logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleResolveIncident = async (incidentId) => {
    setResolvingId(incidentId);
    setIncidentFeedback(null);
    try {
      const res = await axios.patch(`${API_BASE_URL}/api/admin/incidents/${incidentId}/resolve`);
      setIncidentFeedback({
        type: 'success',
        text: `Incident ${incidentId.slice(0, 8)} marked as RESOLVED! Purged from public Live Map and Route Planner.`
      });
      await fetchRegionalIncidents();
      await fetchAdminOverview();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setIncidentFeedback({
        type: 'error',
        text: detail || 'Failed to resolve incident.'
      });
    } finally {
      setResolvingId(null);
    }
  };

  const handleReopenIncident = async (incidentId) => {
    setResolvingId(incidentId);
    setIncidentFeedback(null);
    try {
      await axios.patch(`${API_BASE_URL}/api/admin/incidents/${incidentId}/reopen`);
      setIncidentFeedback({
        type: 'success',
        text: `Incident ${incidentId.slice(0, 8)} reopened as an active flood hazard.`
      });
      await fetchRegionalIncidents();
      await fetchAdminOverview();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setIncidentFeedback({
        type: 'error',
        text: detail || 'Failed to reopen incident.'
      });
    } finally {
      setResolvingId(null);
    }
  };

  const openConfirmModal = (app, type) => {
    setSelectedApp(app);
    setActionType(type);
    setReviewNote('');
    setModalFeedback(null);
  };

  const closeConfirmModal = () => {
    setSelectedApp(null);
    setActionType(null);
    setReviewNote('');
    setModalFeedback(null);
  };

  const handleConfirmReview = async () => {
    if (!selectedApp || !actionType) return;

    setActionSubmitting(true);
    setModalFeedback(null);
    try {
      await axios.post(`${API_BASE_URL}/api/admin-requests/${selectedApp.id}/review`, {
        action: actionType,
        note: reviewNote.trim() || null
      });

      await fetchApplications();
      await fetchAdminOverview();
      closeConfirmModal();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setModalFeedback({
        type: 'error',
        text: detail || `Failed to ${actionType} application.`
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const pendingApps = applications.filter(a => a.status === 'pending');
  const reviewedApps = applications.filter(a => a.status !== 'pending');

  const filteredIncidents = (regionalData?.incidents || []).filter(inc => {
    if (incidentStatusFilter === 'active') return inc.status === 'active';
    if (incidentStatusFilter === 'resolved') return inc.status === 'resolved';
    return true;
  });

  return (
    <div style={{ maxWidth: '1060px', margin: '30px auto 60px auto', padding: '0 16px' }}>

      {/* Admin Header Card */}
      <div className="glass-card" style={{ marginBottom: '24px', background: '#0f172a', color: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: '12px',
              background: '#ef4444',
              border: '2px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(239, 68, 68, 0.5)'
            }}>
              <ShieldAlert size={30} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ffffff' }}>
                  {user?.name}
                </h2>
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: '1.5px solid #000000',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.74rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {user?.role === 'superadmin' ? 'Superadmin Commander' : 'Regional Admin Officer'}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '3px' }}>
                Emergency Operations & Flood Control Command • {user?.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => { fetchAdminOverview(); fetchRegionalIncidents(); fetchApplications(); }}
              disabled={loading || loadingIncidents}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
              title="Refresh Telemetry"
            >
              <RefreshCw size={14} style={(loading || loadingIncidents) ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>Sync All</span>
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
        marginBottom: '24px',
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
          <span>Backend Clearance: Authenticated Administrative Session with Regional Enforcement.</span>
        </div>
        <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#991b1b' }}>
          Assigned Radius: {regionalData?.radius_km || 5.0} km
        </div>
      </div>

      {/* Error notification */}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff', boxShadow: '4px 4px 0px #111111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Jurisdiction Issues
            </span>
            <MapPin size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>
            {regionalData?.total_in_radius ?? '0'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Within {regionalData?.radius_km || 5.0} km perimeter
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff', boxShadow: '4px 4px 0px #111111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Active Hazards
            </span>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>
            {regionalData?.active_in_radius ?? '0'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Requires field action or clearance
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff', boxShadow: '4px 4px 0px #111111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Cleared / Resolved
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#16a34a' }}>
            {regionalData?.resolved_in_radius ?? '0'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Purged from live routing maps
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff', boxShadow: '4px 4px 0px #111111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
              Pending Apps
            </span>
            <Clock size={18} color="#eab308" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ca8a04' }}>
            {pendingApps.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Awaiting credential verification
          </div>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
        <button
          onClick={() => setMainTab('issues')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 900,
            fontSize: '0.92rem',
            border: '3px solid #111111',
            cursor: 'pointer',
            background: mainTab === 'issues' ? '#FFCE32' : '#ffffff',
            boxShadow: mainTab === 'issues' ? '4px 4px 0px #111111' : 'none',
            color: '#111111',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <MapPin size={18} />
          <span>Assigned Sector Issues ({regionalData?.total_in_radius ?? 0})</span>
        </button>

        <button
          onClick={() => setMainTab('applications')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 900,
            fontSize: '0.92rem',
            border: '3px solid #111111',
            cursor: 'pointer',
            background: mainTab === 'applications' ? '#FFCE32' : '#ffffff',
            boxShadow: mainTab === 'applications' ? '4px 4px 0px #111111' : 'none',
            color: '#111111',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={18} />
          <span>Municipal Access Applications ({pendingApps.length})</span>
        </button>

        <button
          onClick={() => { setMainTab('audit'); if (auditLogs.length === 0) fetchAuditLogs(); }}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 900,
            fontSize: '0.92rem',
            border: '3px solid #111111',
            cursor: 'pointer',
            background: mainTab === 'audit' ? '#FFCE32' : '#ffffff',
            boxShadow: mainTab === 'audit' ? '4px 4px 0px #111111' : 'none',
            color: '#111111',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={18} />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* Feedback banner for incident actions */}
      {incidentFeedback && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          background: incidentFeedback.type === 'success' ? '#ecfdf5' : '#fee2e2',
          border: `2px solid ${incidentFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
          boxShadow: `3px 3px 0px ${incidentFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: incidentFeedback.type === 'success' ? '#065f46' : '#991b1b',
          fontWeight: 800,
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {incidentFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{incidentFeedback.text}</span>
          </div>
          <button onClick={() => setIncidentFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* TAB 1: REGIONAL INCIDENTS MANAGEMENT */}
      {mainTab === 'issues' && (
        <div>
          {/* Assigned Jurisdiction Station Banner */}
          <div className="glass-card" style={{ marginBottom: '20px', padding: '20px', background: '#f8fafc', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Compass size={20} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#0f172a' }}>
                    Command Post: {regionalData?.region?.region_name || 'Central Municipal Sector'}
                  </h3>
                </div>
                <div style={{ color: '#64748b', fontSize: '0.86rem' }}>
                  📍 Station Coordinates: {regionalData?.region?.center_latitude ?? 19.0760}, {regionalData?.region?.center_longitude ?? 72.8777} •
                  <strong> Authorized Surveillance Radius: {regionalData?.radius_km || 5.0} km</strong>
                </div>
              </div>

              {/* Status filter buttons */}
              <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '4px', borderRadius: '8px', border: '2px solid #111111' }}>
                <button
                  onClick={() => setIncidentStatusFilter('all')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: incidentStatusFilter === 'all' ? '#FFCE32' : 'transparent',
                    color: '#111111'
                  }}
                >
                  All ({regionalData?.total_in_radius ?? 0})
                </button>
                <button
                  onClick={() => setIncidentStatusFilter('active')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: incidentStatusFilter === 'active' ? '#ef4444' : 'transparent',
                    color: incidentStatusFilter === 'active' ? '#ffffff' : '#111111'
                  }}
                >
                  Active ({regionalData?.active_in_radius ?? 0})
                </button>
                <button
                  onClick={() => setIncidentStatusFilter('resolved')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: incidentStatusFilter === 'resolved' ? '#10b981' : 'transparent',
                    color: incidentStatusFilter === 'resolved' ? '#ffffff' : '#111111'
                  }}
                >
                  Resolved ({regionalData?.resolved_in_radius ?? 0})
                </button>
              </div>
            </div>
          </div>

          {/* Incidents List */}
          {loadingIncidents ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', border: '3px solid #111111', borderRadius: '8px' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ marginTop: '10px', fontWeight: 800 }}>Scanning sector within {regionalData?.radius_km || 5.0}km radius...</div>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: '#ffffff', border: '3px solid #111111', borderRadius: '8px' }}>
              <CheckCircle2 size={42} color="#10b981" style={{ margin: '0 auto 12px auto' }} />
              <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>No Incidents Found</h4>
              <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                {incidentStatusFilter === 'active'
                  ? `All streets within your ${regionalData?.radius_km || 5.0}km radius are currently clear of waterlogging!`
                  : `No incidents matching '${incidentStatusFilter}' filter in this sector.`}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
              {filteredIncidents.map((inc) => {
                const isResolved = inc.status === 'resolved';
                const isCritical = inc.estimated_depth_cm >= 30 || inc.risk_level === 'critical';

                return (
                  <div
                    key={inc.incident_id}
                    className="glass-card"
                    style={{
                      padding: '18px',
                      background: '#ffffff',
                      border: '3px solid #111111',
                      boxShadow: isCritical && !isResolved ? '5px 5px 0px #ef4444' : '4px 4px 0px #111111',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      {/* Top Header Card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          border: '1.5px solid #111111',
                          background: isResolved ? '#d1fae5' : (isCritical ? '#fee2e2' : '#fef3c7'),
                          color: isResolved ? '#065f46' : (isCritical ? '#991b1b' : '#92400e')
                        }}>
                          {isResolved ? 'RESOLVED / CLEARED ✓' : (isCritical ? 'CRITICAL STALL HAZARD' : 'CAUTION WATER')}
                        </span>

                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={13} />
                          <span>{inc.distance_from_post_km !== undefined ? `${inc.distance_from_post_km} km away` : 'Within radius'}</span>
                        </span>
                      </div>

                      {/* Image Thumbnail with Click-to-Enlarge */}
                      {(inc.annotated_image_url || inc.raw_image_url) ? (
                        <div
                          onClick={() => setPreviewImage(inc.annotated_image_url || inc.raw_image_url)}
                          style={{
                            position: 'relative',
                            height: '140px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '2px solid #111111',
                            marginBottom: '12px',
                            cursor: 'pointer',
                            background: '#020617'
                          }}
                          title="Click to view full photo and waterline gauge"
                        >
                          <img
                            src={inc.annotated_image_url || inc.raw_image_url}
                            alt="Flood Evidence"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: 6,
                            right: 6,
                            background: 'rgba(0, 0, 0, 0.75)',
                            color: '#ffffff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Maximize2 size={11} />
                            <span>View YOLO Proof</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          height: '80px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
                          border: '2px dashed #94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748b',
                          fontSize: '0.78rem',
                          marginBottom: '12px'
                        }}>
                          Sensor Telemetry Only (No Photo)
                        </div>
                      )}

                      {/* Metric Depth & Confidence */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>
                            Water Depth
                          </div>
                          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: isResolved ? '#64748b' : (isCritical ? '#dc2626' : '#d97706') }}>
                            {inc.estimated_depth_cm} <span style={{ fontSize: '0.9rem' }}>cm</span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>
                            Safety Score
                          </div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: inc.safety_score < 40 ? '#ef4444' : '#10b981' }}>
                            {inc.safety_score} <span style={{ fontSize: '0.8rem' }}>/100</span>
                          </div>
                        </div>
                      </div>

                      {/* Details Strip */}
                      <div style={{ fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginBottom: '12px' }}>
                        <div>GPS: {parseFloat(inc.latitude).toFixed(4)}, {parseFloat(inc.longitude).toFixed(4)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                          <Clock size={12} />
                          <span>Logged: {inc.reported_at ? new Date(inc.reported_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {!isResolved ? (
                        <button
                          onClick={() => handleResolveIncident(inc.incident_id)}
                          disabled={resolvingId === inc.incident_id}
                          className="btn btn-emerald"
                          style={{
                            flex: 1,
                            fontSize: '0.82rem',
                            padding: '8px',
                            fontWeight: 900,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Check size={14} />
                          <span>{resolvingId === inc.incident_id ? 'Clearing...' : 'Mark as Resolved'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReopenIncident(inc.incident_id)}
                          disabled={resolvingId === inc.incident_id}
                          className="btn btn-secondary"
                          style={{
                            flex: 1,
                            fontSize: '0.82rem',
                            padding: '8px',
                            fontWeight: 800,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>Reopen Hazard</span>
                        </button>
                      )}

                      <Link
                        to={`/map?focus=${inc.incident_id}&lat=${inc.latitude}&lon=${inc.longitude}`}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.82rem',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none'
                        }}
                        title="Locate on Live GIS Map"
                      >
                        <Eye size={14} />
                        <span>Map</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPLICATIONS MANAGEMENT */}
      {mainTab === 'applications' && (
        <div className="glass-card" style={{ padding: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Municipal Officer Applications</h3>
            <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '2px solid #111111' }}>
              <button
                onClick={() => setAppSubTab('pending')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: appSubTab === 'pending' ? '#FFCE32' : 'transparent',
                  color: '#111111'
                }}
              >
                Pending ({pendingApps.length})
              </button>
              <button
                onClick={() => setAppSubTab('history')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: appSubTab === 'history' ? '#FFCE32' : 'transparent',
                  color: '#111111'
                }}
              >
                Processed ({reviewedApps.length})
              </button>
            </div>
          </div>

          {loadingApps ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (appSubTab === 'pending' ? pendingApps : reviewedApps).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
              No applications in '{appSubTab}' state.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(appSubTab === 'pending' ? pendingApps : reviewedApps).map((app) => (
                <div
                  key={app.id}
                  style={{
                    padding: '16px',
                    border: '2px solid #111111',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>
                      {app.user_name || 'Applicant'} ({app.user_email})
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.86rem', marginTop: '4px' }}>
                      Reason: "{app.reason}"
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '4px' }}>
                      Submitted: {new Date(app.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {app.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openConfirmModal(app, 'approve')}
                        className="btn btn-emerald"
                        style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 800 }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => openConfirmModal(app, 'reject')}
                        className="btn btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 800, color: '#dc2626' }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {mainTab === 'audit' && (
        <div className="glass-card" style={{ padding: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 900 }}>System Audit Trail</h3>
          {loadingLogs ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No audit records.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc'
                  }}
                >
                  <div>
                    <strong>{log.action}</strong> by <code>{log.actor_name || log.actor_id?.slice(0, 8)}</code>
                    {log.details && <span style={{ color: '#64748b', marginLeft: '6px' }}>— {log.details}</span>}
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '850px',
              width: '100%',
              background: '#0f172a',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '3px solid #ffffff',
              boxShadow: '0 0 30px rgba(0, 0, 0, 0.9)'
            }}
          >
            <div style={{
              padding: '12px 18px',
              background: '#1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #334155',
              color: '#ffffff'
            }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>YOLOv8 Waterline Proof & Physical Baseline</span>
              <button
                onClick={() => setPreviewImage(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '10px', textAlign: 'center', background: '#020617' }}>
              <img
                src={previewImage}
                alt="Enlarged Flood Proof"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '4px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Application Review Confirmation Modal */}
      {selectedApp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            maxWidth: '500px',
            width: '100%',
            borderRadius: '12px',
            border: '3px solid #111111',
            boxShadow: '8px 8px 0px #111111',
            padding: '24px'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', fontWeight: 900 }}>
              Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
            </h3>
            <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.88rem' }}>
              Applicant: <strong>{selectedApp.user_name}</strong> ({selectedApp.user_email})
            </p>

            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.82rem', marginBottom: '6px' }}>
              Review Note (Optional):
            </label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add verification notes..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '2px solid #111111',
                marginBottom: '16px',
                fontFamily: 'inherit'
              }}
            />

            {modalFeedback && (
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.82rem', marginBottom: '12px' }}>
                {modalFeedback.text}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={closeConfirmModal} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmReview}
                disabled={actionSubmitting}
                className={actionType === 'approve' ? 'btn btn-emerald' : 'btn btn-primary'}
                style={{ padding: '8px 16px', fontWeight: 800 }}
              >
                {actionSubmitting ? 'Processing...' : `Confirm ${actionType === 'approve' ? 'Approve' : 'Reject'}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

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
  Eye,
  Camera,
  Navigation,
  Sliders,
  LocateFixed,
  ExternalLink
} from 'lucide-react';

import { getApiBaseUrl, fetchWithFallback } from '../utils/apiConfig';

const API_BASE_URL = getApiBaseUrl();

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Applications tab state
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'history', 'audit'
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Confirmation Modal state
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
  const [reviewNote, setReviewNote] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  // Operational Sector & Geofenced Radius State
  const SECTOR_PRESETS = [
    { name: 'Nagpur Central (HQ)', lat: 21.1463, lon: 79.0849, region: 'Nagpur' },
    { name: 'Nagpur Sitabuldi & Civil Lines', lat: 21.1534, lon: 79.0803, region: 'Nagpur' },
    { name: 'Nagpur South & Airport Corridor', lat: 21.1093, lon: 79.0596, region: 'Nagpur' },
    { name: 'Mumbai Western Suburbs (Bandra/BKC)', lat: 19.0626, lon: 72.8491, region: 'Mumbai' },
    { name: 'Mumbai Island City (Dadar/Parel)', lat: 19.0065, lon: 72.8390, region: 'Mumbai' }
  ];

  const [selectedSector, setSelectedSector] = useState(SECTOR_PRESETS[0]);
  const [sectorRadiusKm, setSectorRadiusKm] = useState(10); // 5km, 10km (Recommended), 25km, null (All)
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('active'); // 'active', 'resolved', 'all'
  const [incidents, setIncidents] = useState([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);
  const [incidentActionSubmitting, setIncidentActionSubmitting] = useState(null);
  const [inspectIncident, setInspectIncident] = useState(null);
  const [incidentToast, setIncidentToast] = useState(null);

  useEffect(() => {
    fetchAdminOverview();
    fetchApplications();
  }, []);

  useEffect(() => {
    fetchAdminIncidents();
  }, [selectedSector, sectorRadiusKm, incidentStatusFilter]);

  const fetchAdminIncidents = async () => {
    setLoadingIncidents(true);
    try {
      const params = {
        status: incidentStatusFilter,
        max_age_hours: 72
      };
      if (selectedSector && sectorRadiusKm !== null) {
        params.lat = selectedSector.lat;
        params.lon = selectedSector.lon;
        params.radius_km = sectorRadiusKm;
      }
      const res = await fetchWithFallback('/api/admin/incidents', { params });
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.warn("Could not load admin incidents:", err);
    } finally {
      setLoadingIncidents(false);
    }
  };

  const handleResolveIncident = async (incidentId, targetStatus = 'resolved') => {
    setIncidentActionSubmitting(incidentId);
    setIncidentToast(null);
    try {
      const res = await fetchWithFallback(`/api/admin/incidents/${incidentId}/status`, {
        method: 'PATCH',
        data: { status: targetStatus }
      });
      setIncidentToast({
        type: 'success',
        text: res.data.message || `Incident ${incidentId.slice(0, 8)} marked as ${targetStatus}.`
      });
      await fetchAdminIncidents();
      await fetchAdminOverview();
      if (inspectIncident && inspectIncident.incident_id === incidentId) {
        setInspectIncident(null);
      }
    } catch (err) {
      setIncidentToast({
        type: 'error',
        text: err.response?.data?.detail || `Failed to update status for incident.`
      });
    } finally {
      setIncidentActionSubmitting(null);
    }
  };

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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'audit' && auditLogs.length === 0) {
      fetchAuditLogs();
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
      const res = await axios.post(`${API_BASE_URL}/api/admin-requests/${selectedApp.id}/review`, {
        action: actionType,
        note: reviewNote.trim() || null
      });

      // Refresh applications and overview stats
      await fetchApplications();
      await fetchAdminOverview();
      if (activeTab === 'audit') {
        await fetchAuditLogs();
      }

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

  return (
    <div style={{ maxWidth: '1000px', margin: '30px auto 60px auto', padding: '0 16px' }}>
      
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
              onClick={() => { fetchAdminOverview(); fetchApplications(); }}
              disabled={loading || loadingApps}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
              title="Refresh Telemetry"
            >
              <RefreshCw size={14} style={(loading || loadingApps) ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>Sync Telemetry</span>
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
          <span>Backend Role Clearance: Verified Admin Session (HTTP-Only Secure Cookie).</span>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '24px' }}>
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
              Pending Admin Apps
            </span>
            <Clock size={18} color="#eab308" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ca8a04' }}>
            {pendingApps.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Awaiting administrative review
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

      {/* SECTION 4: Flood Hazard Incident Command & Sector Triage */}
      <div className="glass-card" style={{ marginBottom: '32px', padding: '28px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        {/* Header & Sector Jurisdiction Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#fee2e2', border: '2px solid #111111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={18} color="#dc2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                Flood Hazard Incident Command & Triage
              </h3>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.88rem', fontWeight: 500 }}>
              Live crowdsourced reports geofenced to your assigned operational sector. Resolving an issue immediately clears it from the Live Map and safe detour calculations.
            </p>
          </div>

          <button
            onClick={fetchAdminIncidents}
            disabled={loadingIncidents}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.84rem' }}
          >
            <RefreshCw size={13} style={loadingIncidents ? { animation: 'spin 1s linear infinite' } : {}} />
            <span>Refresh Hazards</span>
          </button>
        </div>

        {/* Sector Assignment & Radius Filter Strip */}
        <div style={{
          background: '#f8fafc',
          border: '2px solid #111111',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          {/* Sector Location Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
              <MapPin size={16} color="#0284c7" />
              <span>Assigned Sector HQ:</span>
            </div>
            <select
              value={selectedSector.name}
              onChange={(e) => {
                const found = SECTOR_PRESETS.find(s => s.name === e.target.value);
                if (found) setSelectedSector(found);
              }}
              style={{
                padding: '8px 12px',
                border: '2px solid #111111',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '0.84rem',
                background: '#ffffff',
                color: '#0f172a',
                boxShadow: '2px 2px 0px #111111',
                cursor: 'pointer'
              }}
            >
              {SECTOR_PRESETS.map((s, idx) => (
                <option key={idx} value={s.name}>
                  {s.name} ({s.region})
                </option>
              ))}
            </select>
          </div>

          {/* Operational Radius Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sector Radius:
            </span>
            {[
              { label: '5 km (Ward)', val: 5 },
              { label: '10 km (Zone)', val: 10 },
              { label: '25 km (Metro)', val: 25 },
              { label: 'All Sectors', val: null }
            ].map((r, idx) => {
              const isSelected = sectorRadiusKm === r.val;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSectorRadiusKm(r.val)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: '2px solid #111111',
                    background: isSelected ? '#FFCE32' : '#ffffff',
                    color: '#111111',
                    boxShadow: isSelected ? '2px 2px 0px #111111' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Filter Tabs (Active vs Resolved vs All) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIncidentStatusFilter('active')}
              style={{
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: '2px solid #111111',
                background: incidentStatusFilter === 'active' ? '#ef4444' : '#f1f5f9',
                color: incidentStatusFilter === 'active' ? '#ffffff' : '#111111',
                boxShadow: incidentStatusFilter === 'active' ? '3px 3px 0px #111111' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className={incidentStatusFilter === 'active' ? 'status-pulse-dot' : ''}></span>
              <span>Active Flood Hazards</span>
            </button>

            <button
              onClick={() => setIncidentStatusFilter('resolved')}
              style={{
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: '2px solid #111111',
                background: incidentStatusFilter === 'resolved' ? '#16a34a' : '#f1f5f9',
                color: incidentStatusFilter === 'resolved' ? '#ffffff' : '#111111',
                boxShadow: incidentStatusFilter === 'resolved' ? '3px 3px 0px #111111' : 'none',
                cursor: 'pointer'
              }}
            >
              <span>Resolved Incidents</span>
            </button>

            <button
              onClick={() => setIncidentStatusFilter('all')}
              style={{
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: '2px solid #111111',
                background: incidentStatusFilter === 'all' ? '#0f172a' : '#f1f5f9',
                color: incidentStatusFilter === 'all' ? '#ffffff' : '#111111',
                boxShadow: incidentStatusFilter === 'all' ? '3px 3px 0px #111111' : 'none',
                cursor: 'pointer'
              }}
            >
              <span>All Reports</span>
            </button>
          </div>

          <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
            Showing <strong>{incidents.length}</strong> hazards within {sectorRadiusKm ? `${sectorRadiusKm} km of ${selectedSector.name}` : 'entire territory'}
          </div>
        </div>

        {/* Action Feedback Toast */}
        {incidentToast && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '6px',
            border: '2px solid #111111',
            boxShadow: '3px 3px 0px #111111',
            marginBottom: '16px',
            fontSize: '0.86rem',
            fontWeight: 700,
            background: incidentToast.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: incidentToast.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{incidentToast.text}</span>
            </div>
            <button onClick={() => setIncidentToast(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 900 }}>✕</button>
          </div>
        )}

        {/* Incident List Table / Cards */}
        {loadingIncidents ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px auto' }} />
            <div>Filtering incidents in sector radius...</div>
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
            <ShieldCheck size={36} color="#16a34a" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Sector Clear of Active Hazards</div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem' }}>
              No {incidentStatusFilter !== 'all' ? incidentStatusFilter : ''} waterlogging reports found within {sectorRadiusKm ? `${sectorRadiusKm} km of ${selectedSector.name}` : 'this sector'}.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111111', textAlign: 'left' }}>
                  <th style={{ padding: '12px', fontWeight: 800 }}>Visual Proof</th>
                  <th style={{ padding: '12px', fontWeight: 800 }}>Depth & Hazard</th>
                  <th style={{ padding: '12px', fontWeight: 800 }}>Sector Distance</th>
                  <th style={{ padding: '12px', fontWeight: 800 }}>Reported At</th>
                  <th style={{ padding: '12px', fontWeight: 800 }}>Status</th>
                  <th style={{ padding: '12px', fontWeight: 800, textAlign: 'right' }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => {
                  const depth = parseFloat(inc.estimated_depth_cm) || 0;
                  const isCritical = depth >= 30 || inc.risk_level === 'critical';
                  const isResolved = inc.status === 'resolved';

                  return (
                    <tr key={inc.incident_id} style={{ borderBottom: '1px solid #e2e8f0', background: isResolved ? '#f8fafc' : (isCritical ? '#fff1f2' : '#ffffff') }}>
                      {/* Visual Proof Thumbnail */}
                      <td style={{ padding: '12px', verticalAlign: 'middle', width: '120px' }}>
                        <div 
                          onClick={() => setInspectIncident(inc)}
                          style={{
                            width: 80,
                            height: 56,
                            borderRadius: '6px',
                            border: '2px solid #111111',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            background: '#0f172a'
                          }}
                          title="Click to Inspect Annotated Visual Proof"
                        >
                          <img 
                            src={inc.annotated_image_url || inc.raw_image_url || 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=300&q=80'} 
                            alt="Proof Visual"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            background: 'rgba(0,0,0,0.7)',
                            borderRadius: '3px',
                            padding: '1px 3px',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <Eye size={10} />
                          </div>
                        </div>
                      </td>

                      {/* Depth Gauge & Hazard */}
                      <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: isCritical ? '#dc2626' : (depth >= 16 ? '#d97706' : '#16a34a') }}>
                            {depth} cm
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            background: isCritical ? '#fee2e2' : (depth >= 16 ? '#fef3c7' : '#dcfce7'),
                            color: isCritical ? '#991b1b' : (depth >= 16 ? '#92400e' : '#166534'),
                            border: '1px solid #111111'
                          }}>
                            {isCritical ? 'CRITICAL (30+ cm)' : (depth >= 16 ? 'CAUTION' : 'SAFE')}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '3px' }}>
                          Safety Index: <strong>{inc.safety_score ?? 'N/A'}/100</strong> • ID: {inc.incident_id?.slice(0, 8)}
                        </div>
                      </td>

                      {/* Sector Distance */}
                      <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>
                          {inc.distance_km !== undefined ? `${inc.distance_km} km` : 'In Region'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          from {selectedSector.name.split(' ')[0]} HQ
                        </div>
                        <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#475569', marginTop: '2px' }}>
                          Lat: {Number(inc.latitude).toFixed(4)}, Lon: {Number(inc.longitude).toFixed(4)}
                        </div>
                      </td>

                      {/* Reported Timestamp */}
                      <td style={{ padding: '12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {new Date(inc.reported_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: isResolved ? '#dcfce7' : '#fee2e2',
                          color: isResolved ? '#166534' : '#991b1b',
                          border: `1px solid ${isResolved ? '#86efac' : '#fca5a5'}`
                        }}>
                          {isResolved ? 'Resolved ✓' : 'Active Hazard'}
                        </span>
                      </td>

                      {/* Admin Actions */}
                      <td style={{ padding: '12px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          {/* Inspect Modal Trigger */}
                          <button
                            type="button"
                            onClick={() => setInspectIncident(inc)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                            title="Inspect ML Visual Telemetry"
                          >
                            <Eye size={13} />
                            <span>Proof</span>
                          </button>

                          {/* Map Pinpoint Link */}
                          <Link
                            to={`/map?lat=${inc.latitude}&lon=${inc.longitude}&incident_id=${inc.incident_id}&highlight=true`}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.78rem', textDecoration: 'none' }}
                            title="Open on GIS Telemetry Map"
                          >
                            <MapPin size={13} color="#0284c7" />
                            <span>Map</span>
                          </Link>

                          {/* Mark as Resolved Action */}
                          {!isResolved ? (
                            <button
                              type="button"
                              onClick={() => handleResolveIncident(inc.incident_id, 'resolved')}
                              disabled={incidentActionSubmitting === inc.incident_id}
                              className="btn btn-emerald"
                              style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                              title="Mark Hazard as Drained and Resolved"
                            >
                              {incidentActionSubmitting === inc.incident_id ? (
                                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Check size={13} />
                              )}
                              <span>Mark Resolved</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleResolveIncident(inc.incident_id, 'active')}
                              disabled={incidentActionSubmitting === inc.incident_id}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.76rem', color: '#475569' }}
                              title="Reactivate Hazard if waterlogged again"
                            >
                              <span>Reopen</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visual Proof Inspection Modal */}
      {inspectIncident && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '3px solid #111111',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '680px',
            width: 'calc(100vw - 28px)',
            boxShadow: '8px 8px 0px #111111',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button
              type="button"
              onClick={() => setInspectIncident(null)}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                background: '#f1f5f9',
                border: '2px solid #111111',
                borderRadius: '6px',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: 900
              }}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Camera size={20} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                Computer Vision Visual Proof & Telemetry
              </h3>
            </div>

            {/* Large Annotated Image Container */}
            <div style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '2px solid #111111',
              boxShadow: '3px 3px 0px #111111',
              background: '#0f172a',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <img 
                src={inspectIncident.annotated_image_url || inspectIncident.raw_image_url} 
                alt="Full Proof Annotated"
                style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', display: 'block' }}
              />
            </div>

            {/* Telemetry Metrics Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Calculated Depth</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: parseFloat(inspectIncident.estimated_depth_cm) >= 30 ? '#dc2626' : '#0284c7' }}>
                  {inspectIncident.estimated_depth_cm} cm
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>YOLO Confidence</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#16a34a' }}>
                  {Math.round(parseFloat(inspectIncident.confidence || 0.9) * 100)}%
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Hazard Status</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, textTransform: 'uppercase', color: inspectIncident.status === 'resolved' ? '#16a34a' : '#ef4444' }}>
                  {inspectIncident.status}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Coordinates</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0f172a', marginTop: '4px' }}>
                  {Number(inspectIncident.latitude).toFixed(4)}, {Number(inspectIncident.longitude).toFixed(4)}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '2px solid #e2e8f0', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setInspectIncident(null)}
                className="btn btn-secondary"
                style={{ padding: '10px 16px', fontSize: '0.86rem' }}
              >
                Close
              </button>

              {inspectIncident.status !== 'resolved' ? (
                <button
                  type="button"
                  onClick={() => handleResolveIncident(inspectIncident.incident_id, 'resolved')}
                  disabled={incidentActionSubmitting === inspectIncident.incident_id}
                  className="btn btn-emerald"
                  style={{ padding: '10px 18px', fontSize: '0.86rem', fontWeight: 800 }}
                >
                  <Check size={16} />
                  <span>Confirm Water Drained & Mark Resolved</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleResolveIncident(inspectIncident.incident_id, 'active')}
                  disabled={incidentActionSubmitting === inspectIncident.incident_id}
                  className="btn btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '0.86rem' }}
                >
                  <span>Reopen Hazard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: Admin Approval Dashboard Section */}
      <div className="glass-card" style={{ marginBottom: '32px', padding: '28px', background: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
              Municipal Access Applications & Triage
            </h3>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
              Review access applications submitted by traffic wardens and field personnel.
            </p>
          </div>

          {/* Navigation Tabs - Horizontally Scrollable on Mobile */}
          <div className="presets-scroll-strip" style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '2px solid #111111' }}>
            <button
              onClick={() => handleTabChange('pending')}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'pending' ? '#FFCE32' : 'transparent',
                color: '#111111',
                boxShadow: activeTab === 'pending' ? '2px 2px 0px #111111' : 'none'
              }}
            >
              Pending ({pendingApps.length})
            </button>
            <button
              onClick={() => handleTabChange('history')}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'history' ? '#FFCE32' : 'transparent',
                color: '#111111',
                boxShadow: activeTab === 'history' ? '2px 2px 0px #111111' : 'none'
              }}
            >
              Reviewed History ({reviewedApps.length})
            </button>
            <button
              onClick={() => handleTabChange('audit')}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'audit' ? '#FFCE32' : 'transparent',
                color: '#111111',
                boxShadow: activeTab === 'audit' ? '2px 2px 0px #111111' : 'none'
              }}
            >
              Security Audit Logs
            </button>
          </div>
        </div>

        {/* TAB 1: Pending Applications */}
        {activeTab === 'pending' && (
          <div>
            {loadingApps ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px auto' }} />
                <div>Loading pending applications...</div>
              </div>
            ) : pendingApps.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '2px dashed #cbd5e1',
                color: '#64748b'
              }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  No Pending Access Requests
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  All submitted applications have been reviewed and processed.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111111', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Applicant</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Reason for Request</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800 }}>Submitted</th>
                      <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApps.map((app) => {
                      const isSelf = app.user_id === user?.id;
                      return (
                        <tr key={app.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{app.user_name || 'Applicant'}</div>
                            <div style={{ color: '#64748b', fontSize: '0.82rem' }}>{app.user_email}</div>
                            {isSelf && (
                              <span style={{
                                display: 'inline-block',
                                marginTop: '4px',
                                background: '#fee2e2',
                                color: '#991b1b',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '1px 6px',
                                borderRadius: '4px'
                              }}>
                                Your own application
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px', verticalAlign: 'top', maxWidth: '380px' }}>
                            <div style={{ color: '#334155', lineHeight: 1.5 }}>{app.reason}</div>
                          </td>
                          <td style={{ padding: '14px', verticalAlign: 'top', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.82rem' }}>
                            {new Date(app.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isSelf ? (
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                Self-approval blocked
                              </span>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  onClick={() => openConfirmModal(app, 'approve')}
                                  className="btn"
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    background: '#22c55e',
                                    color: '#ffffff',
                                    border: '2px solid #111111',
                                    boxShadow: '2px 2px 0px #111111'
                                  }}
                                >
                                  <Check size={14} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => openConfirmModal(app, 'reject')}
                                  className="btn"
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: '2px solid #111111',
                                    boxShadow: '2px 2px 0px #111111'
                                  }}
                                >
                                  <X size={14} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Reviewed History */}
        {activeTab === 'history' && (
          <div>
            {reviewedApps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                No past applications have been processed yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111111', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>Applicant</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>Status</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>Reason</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>Reviewer & Date</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>Reviewer Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewedApps.map((app) => (
                      <tr key={app.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 800 }}>{app.user_name || 'User'}</div>
                          <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{app.user_email}</div>
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background: app.status === 'approved' ? '#dcfce7' : '#fee2e2',
                            color: app.status === 'approved' ? '#166534' : '#991b1b',
                            border: `1px solid ${app.status === 'approved' ? '#86efac' : '#fca5a5'}`
                          }}>
                            {app.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top', maxWidth: '280px', color: '#334155' }}>
                          {app.reason}
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#64748b' }}>
                          <div>{app.reviewer_name || 'Admin'}</div>
                          <div>{app.reviewed_at ? new Date(app.reviewed_at).toLocaleDateString() : 'N/A'}</div>
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top', color: '#64748b', fontStyle: app.review_note ? 'italic' : 'normal' }}>
                          {app.review_note || 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Security Audit Logs */}
        {activeTab === 'audit' && (
          <div>
            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px auto' }} />
                <div>Loading audit logs...</div>
              </div>
            ) : auditLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                No security audit logs recorded yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111111', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 800 }}>Timestamp</th>
                      <th style={{ padding: '8px 12px', fontWeight: 800 }}>Action</th>
                      <th style={{ padding: '8px 12px', fontWeight: 800 }}>Target User ID</th>
                      <th style={{ padding: '8px 12px', fontWeight: 800 }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            textTransform: 'uppercase',
                            background: log.action.includes('approved') || log.action.includes('bootstrap') ? '#dcfce7' : log.action.includes('rejected') ? '#fee2e2' : '#eff6ff',
                            color: log.action.includes('approved') || log.action.includes('bootstrap') ? '#166534' : log.action.includes('rejected') ? '#991b1b' : '#1d4ed8'
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                          {log.target_user_id ? log.target_user_id.slice(0, 8) + '...' : 'System'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || 'None')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {selectedApp && (
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
            padding: '22px 18px',
            maxWidth: '520px',
            width: 'calc(100vw - 28px)',
            boxShadow: '8px 8px 0px #111111',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: actionType === 'approve' ? '#22c55e' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}>
                {actionType === 'approve' ? <ShieldCheck size={26} /> : <AlertTriangle size={26} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                  Confirm Application {actionType === 'approve' ? 'Approval' : 'Rejection'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {actionType === 'approve' 
                    ? 'Promoting applicant to Administrator clearance tier.' 
                    : 'Application will be marked rejected. Applicant retains user role.'}
                </p>
              </div>
            </div>

            {/* Applicant Summary */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '18px',
              fontSize: '0.88rem'
            }}>
              <div style={{ marginBottom: '6px' }}>
                <strong>Applicant:</strong> {selectedApp.user_name} ({selectedApp.user_email})
              </div>
              <div style={{ color: '#475569', fontSize: '0.84rem' }}>
                <strong>Reason:</strong> "{selectedApp.reason}"
              </div>
            </div>

            {/* Error or validation in modal */}
            {modalFeedback && (
              <div style={{
                padding: '10px 14px',
                background: '#fee2e2',
                border: '1.5px solid #ef4444',
                borderRadius: '6px',
                color: '#991b1b',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{modalFeedback.text}</span>
              </div>
            )}

            {/* Review Note input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px', color: '#0f172a' }}>
                Optional Administrative Review Note
              </label>
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={actionType === 'approve' ? 'e.g. Approved for North Sector Operations' : 'e.g. Insufficient municipal credentials provided'}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '0.88rem',
                  border: '2px solid #111111',
                  borderRadius: '6px',
                  background: '#ffffff',
                  outline: 'none'
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={actionSubmitting}
                className="btn btn-secondary"
                style={{ padding: '10px 16px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={actionSubmitting}
                className="btn"
                style={{
                  padding: '10px 18px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  background: actionType === 'approve' ? '#22c55e' : '#ef4444',
                  color: '#ffffff',
                  border: '2px solid #111111',
                  boxShadow: '3px 3px 0px #111111'
                }}
              >
                {actionSubmitting ? (
                  <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  actionType === 'approve' ? <Check size={16} /> : <X size={16} />
                )}
                <span>Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

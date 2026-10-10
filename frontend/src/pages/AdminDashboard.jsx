import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import BackButton from '../components/BackButton';
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
  UploadCloud,
  Camera,
  Search,
  Filter,
  Eye,
  Download,
  Calendar,
  Layers,
  Compass
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isSuperadmin = user?.role === 'superadmin';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery', 'overview', 'applications', 'regions', 'audit'

  // Regional image gallery state
  const [region, setRegion] = useState(null);
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesError, setImagesError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected image preview modal
  const [previewImage, setPreviewImage] = useState(null);

  // General Admin Overview state
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Superadmin Applications state
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Superadmin Regions list
  const [allRegions, setAllRegions] = useState([]);
  const [loadingRegions, setLoadingRegions] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Review Modal state (for Superadmin)
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
  const [reviewNote, setReviewNote] = useState('');
  const [regionName, setRegionName] = useState('');
  const [centerLat, setCenterLat] = useState('12.9716');
  const [centerLon, setCenterLon] = useState('77.5946');
  const [radiusKm, setRadiusKm] = useState('5.0');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  useEffect(() => {
    fetchRegionalImages();
    fetchAdminOverview();
    if (isSuperadmin) {
      fetchApplications();
    }
  }, [user]);

  const fetchRegionalImages = async () => {
    setLoadingImages(true);
    setImagesError(null);
    try {
      let url = `${API_BASE_URL}/api/admin/images?limit=100`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await axios.get(url);
      setRegion(res.data.region);
      setImages(res.data.images || []);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setImagesError(detail || "Failed to load regional images.");
    } finally {
      setLoadingImages(false);
    }
  };

  const fetchAdminOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/overview`);
      setOverview(res.data);
    } catch (err) {
      console.warn("Overview load error:", err);
    } finally {
      setLoadingOverview(false);
    }
  };

  const fetchApplications = async () => {
    if (!isSuperadmin) return;
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

  const fetchAllRegions = async () => {
    if (!isSuperadmin) return;
    setLoadingRegions(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/superadmin/regions`);
      setAllRegions(res.data.regions || []);
    } catch (err) {
      console.warn("Could not load all regions:", err);
    } finally {
      setLoadingRegions(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/audit-logs?limit=50`);
      setAuditLogs(res.data.logs || []);
    } catch (err) {
      console.warn("Could not load audit logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'regions' && allRegions.length === 0) fetchAllRegions();
    if (tab === 'audit' && auditLogs.length === 0) fetchAuditLogs();
    if (tab === 'applications' && applications.length === 0) fetchApplications();
  };

  const openConfirmModal = (app, type) => {
    setSelectedApp(app);
    setActionType(type);
    setReviewNote('');
    setRegionName(app.requested_region || 'Municipal Sector');
    setCenterLat('12.9716');
    setCenterLon('77.5946');
    setRadiusKm('5.0');
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

    const payload = {
      action: actionType,
      note: reviewNote.trim() || null
    };

    if (actionType === 'approve') {
      const lat = parseFloat(centerLat);
      const lon = parseFloat(centerLon);
      const rad = parseFloat(radiusKm);
      if (isNaN(lat) || isNaN(lon)) {
        setModalFeedback({ type: 'error', text: 'Valid latitude and longitude coordinates are required for regional assignment.' });
        setActionSubmitting(false);
        return;
      }
      payload.region_name = regionName.trim() || 'Assigned Sector';
      payload.center_latitude = lat;
      payload.center_longitude = lon;
      payload.radius_km = isNaN(rad) ? 5.0 : rad;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/admin-requests/${selectedApp.id}/review`, payload);
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

  return (
    <div style={{ maxWidth: '1060px', margin: '24px auto 60px auto', padding: '0 16px' }}>
      
      {/* Top Left Theme-Consistent Back Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
        <BackButton to="/" label="Back to Home" />
      </div>

      {/* Admin Operations Header Card */}
      <div className="glass-card" style={{ marginBottom: '20px', background: '#0f172a', color: '#ffffff', border: '3px solid #111111', boxShadow: '6px 6px 0px #111111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              background: isSuperadmin ? '#9333ea' : '#ef4444',
              border: '2px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 14px ${isSuperadmin ? 'rgba(147, 51, 234, 0.5)' : 'rgba(239, 68, 68, 0.4)'}`
            }}>
              <ShieldAlert size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#ffffff' }}>
                  {user?.name}
                </h2>
                <span style={{
                  background: isSuperadmin ? '#9333ea' : '#ef4444',
                  color: '#ffffff',
                  border: '1.5px solid #000000',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {user?.role}
                </span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.86rem', marginTop: '3px' }}>
                {region ? (
                  <span>Assigned Geographic Region: <strong>{region.region_name}</strong> (Radius: {region.radius_km} km)</span>
                ) : (
                  <span>Regional Flood Operations Command • {user?.email}</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              to="/admin/upload"
              className="btn"
              style={{
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 900,
                background: '#FFCE32',
                color: '#111111',
                border: '2px solid #111111',
                boxShadow: '3px 3px 0px #111111',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Camera size={15} />
              <span>Upload Regional Image</span>
            </Link>

            <button
              onClick={() => { fetchRegionalImages(); fetchAdminOverview(); if (isSuperadmin) fetchApplications(); }}
              disabled={loadingImages}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#1e293b', color: '#ffffff', borderColor: '#334155' }}
              title="Refresh Telemetry"
            >
              <RefreshCw size={14} style={loadingImages ? { animation: 'spin 1s linear infinite' } : {}} />
              <span>Sync</span>
            </button>

            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#334155', color: '#ffffff', borderColor: '#475569' }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleTabChange('gallery')}
          className="btn"
          style={{
            padding: '9px 18px',
            fontSize: '0.88rem',
            fontWeight: 800,
            background: activeTab === 'gallery' ? '#0ea5e9' : '#ffffff',
            color: activeTab === 'gallery' ? '#ffffff' : '#111111',
            border: '2px solid #111111',
            boxShadow: '3px 3px 0px #111111'
          }}
        >
          <span>Regional Gallery & Map ({images.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('overview')}
          className="btn"
          style={{
            padding: '9px 18px',
            fontSize: '0.88rem',
            fontWeight: 800,
            background: activeTab === 'overview' ? '#0ea5e9' : '#ffffff',
            color: activeTab === 'overview' ? '#ffffff' : '#111111',
            border: '2px solid #111111',
            boxShadow: '3px 3px 0px #111111'
          }}
        >
          <span>Operations Telemetry</span>
        </button>

        {isSuperadmin && (
          <>
            <button
              onClick={() => handleTabChange('applications')}
              className="btn"
              style={{
                padding: '9px 18px',
                fontSize: '0.88rem',
                fontWeight: 800,
                background: activeTab === 'applications' ? '#9333ea' : '#ffffff',
                color: activeTab === 'applications' ? '#ffffff' : '#111111',
                border: '2px solid #111111',
                boxShadow: '3px 3px 0px #111111',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>Admin Requests</span>
              {pendingApps.length > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.72rem'
                }}>
                  {pendingApps.length}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('regions')}
              className="btn"
              style={{
                padding: '9px 18px',
                fontSize: '0.88rem',
                fontWeight: 800,
                background: activeTab === 'regions' ? '#9333ea' : '#ffffff',
                color: activeTab === 'regions' ? '#ffffff' : '#111111',
                border: '2px solid #111111',
                boxShadow: '3px 3px 0px #111111'
              }}
            >
              <span>Regional Allocations</span>
            </button>
          </>
        )}

        <button
          onClick={() => handleTabChange('audit')}
          className="btn"
          style={{
            padding: '9px 18px',
            fontSize: '0.88rem',
            fontWeight: 800,
            background: activeTab === 'audit' ? '#111111' : '#ffffff',
            color: activeTab === 'audit' ? '#ffffff' : '#111111',
            border: '2px solid #111111',
            boxShadow: '3px 3px 0px #111111'
          }}
        >
          <span>Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: Regional Image Gallery & Spatial Map */}
      {activeTab === 'gallery' && (
        <div>
          {/* Active Region Header Pill */}
          {region && (
            <div style={{
              padding: '14px 20px',
              borderRadius: '8px',
              background: '#eff6ff',
              border: '2px solid #0284c7',
              boxShadow: '3px 3px 0px #0284c7',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <strong style={{ fontSize: '1rem', color: '#0369a1' }}>
                  Authorized Jurisdiction: {region.region_name}
                </strong>
                <div style={{ color: '#0284c7', fontSize: '0.82rem', marginTop: '2px' }}>
                  Center: Lat {region.center_latitude.toFixed(4)}, Lon {region.center_longitude.toFixed(4)} • Radius: {region.radius_km} km
                </div>
              </div>
              <div style={{
                background: '#dcfce7',
                color: '#166534',
                border: '1.5px solid #166534',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 900,
                textTransform: 'uppercase'
              }}>
                Strict Regional Filter Active
              </div>
            </div>
          )}

          {/* Search and Filters Bar */}
          <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', background: '#ffffff', border: '2px solid #111111', boxShadow: '3px 3px 0px #111111' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '11px' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchRegionalImages(); }}
                    placeholder="Search regional images by title or keyword..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      border: '2px solid #111111',
                      borderRadius: '6px',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #111111',
                    borderRadius: '6px',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    background: '#ffffff'
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="completed">YOLO Processed</option>
                  <option value="error">Processing Error</option>
                </select>
                <button
                  onClick={fetchRegionalImages}
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', background: '#0ea5e9' }}
                >
                  Filter
                </button>
              </div>

              <Link
                to="/admin/upload"
                className="btn btn-primary"
                style={{ padding: '8px 16px', background: '#FFCE32', color: '#111', fontWeight: 800 }}
              >
                + New Regional Upload
              </Link>
            </div>
          </div>

          {/* Regional Map Preview */}
          {region && (
            <div style={{
              height: '280px',
              border: '3px solid #111111',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '24px',
              boxShadow: '4px 4px 0px #111111'
            }}>
              <MapContainer
                center={[region.center_latitude, region.center_longitude]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Visual Circle of Region */}
                <Circle
                  center={[region.center_latitude, region.center_longitude]}
                  radius={region.radius_km * 1000}
                  pathOptions={{ color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.12, weight: 2 }}
                />

                {/* Markers for regional images */}
                {images.map((img) => (
                  <Marker
                    key={img.id}
                    position={[img.latitude, img.longitude]}
                    eventHandlers={{
                      click: () => setPreviewImage(img)
                    }}
                  >
                    <Popup>
                      <div style={{ padding: '4px' }}>
                        <strong style={{ display: 'block', fontSize: '0.9rem' }}>{img.title}</strong>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Depth: <strong>{img.estimated_depth_cm !== null ? `${img.estimated_depth_cm} cm` : 'N/A'}</strong>
                        </div>
                        <button
                          onClick={() => setPreviewImage(img)}
                          style={{
                            marginTop: '6px',
                            background: '#0ea5e9',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.74rem',
                            cursor: 'pointer'
                          }}
                        >
                          Inspect Image
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}

          {/* Image Gallery Grid */}
          {loadingImages ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9', margin: '0 auto 12px auto' }} />
              <h4 style={{ fontWeight: 800 }}>Loading regional image repository...</h4>
            </div>
          ) : images.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center', background: '#ffffff', border: '3px solid #111111' }}>
              <Camera size={48} color="#94a3b8" style={{ margin: '0 auto 14px auto' }} />
              <h3 style={{ margin: '0 0 8px 0', fontWeight: 900 }}>No Images In Authorized Region</h3>
              <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                There are currently no flood images recorded within the {region?.radius_km} km radius of {region?.region_name}.
              </p>
              <Link to="/admin/upload" className="btn btn-primary" style={{ padding: '9px 20px', background: '#0ea5e9' }}>
                Submit First Regional Photograph
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {images.map((img) => (
                <div
                  key={img.id}
                  className="glass-card"
                  style={{
                    padding: '0',
                    background: '#ffffff',
                    border: '3px solid #111111',
                    boxShadow: '4px 4px 0px #111111',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Thumbnail Container */}
                  <div
                    onClick={() => setPreviewImage(img)}
                    style={{
                      height: '180px',
                      background: '#0f172a',
                      position: 'relative',
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}
                  >
                    <img
                      src={img.view_url || 'https://via.placeholder.com/300x200?text=Private+S3+Image'}
                      alt={img.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    
                    {/* Status Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: img.estimated_depth_cm >= 30 ? '#ef4444' : '#10b981',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      border: '1.5px solid #111111'
                    }}>
                      {img.estimated_depth_cm !== null ? `${img.estimated_depth_cm} cm` : 'Analyzed'}
                    </div>

                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={12} />
                      <span>{new Date(img.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Image Details */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                        {img.title}
                      </h4>
                      <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                        {img.description || 'No descriptive field notes.'}
                      </p>
                      <div style={{ fontSize: '0.76rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} color="#0284c7" />
                        <span>Lat {img.latitude.toFixed(4)}, Lon {img.longitude.toFixed(4)}</span>
                        {img.distance_to_center_km !== undefined && (
                          <span style={{ color: '#0369a1', fontWeight: 700 }}>({img.distance_to_center_km} km)</span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        By {img.uploader_name ? img.uploader_name.split(' ')[0] : 'Warden'}
                      </span>
                      <button
                        onClick={() => setPreviewImage(img)}
                        className="btn"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          background: '#0ea5e9',
                          color: '#fff',
                          border: '1.5px solid #111',
                          boxShadow: '1px 1px 0px #111'
                        }}
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Operations Telemetry */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Citizens Enrolled</span>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a' }}>{overview?.stats?.registered_citizens ?? '...'}</div>
            </div>
            <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Authorized Officers</span>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0284c7' }}>{overview?.stats?.admin_officers ?? '...'}</div>
            </div>
            <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Active Hazards (24h)</span>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ea580c' }}>{overview?.stats?.active_incidents_24h ?? '...'}</div>
            </div>
            <div className="glass-card" style={{ padding: '20px', border: '3px solid #111111', background: '#ffffff' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Emergency Alerts</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#16a34a', marginTop: '6px' }}>ONLINE (AWS SNS)</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Superadmin Applications Review Console */}
      {activeTab === 'applications' && isSuperadmin && (
        <div className="glass-card" style={{ padding: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 900 }}>
            Superadmin Access Request Review Console
          </h3>

          {loadingApps ? (
            <div style={{ textAlign: 'center', padding: '40px' }}><RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : pendingApps.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1' }}>
              <CheckCircle2 size={36} color="#16a34a" style={{ margin: '0 auto 8px auto' }} />
              <strong>All Access Requests Reviewed</strong>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>There are no pending administrator access requests awaiting review.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111', textAlign: 'left' }}>
                    <th style={{ padding: '10px', fontWeight: 800 }}>Applicant</th>
                    <th style={{ padding: '10px', fontWeight: 800 }}>Organization</th>
                    <th style={{ padding: '10px', fontWeight: 800 }}>Requested Region</th>
                    <th style={{ padding: '10px', fontWeight: 800 }}>Justification</th>
                    <th style={{ padding: '10px', fontWeight: 800, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApps.map((app) => (
                    <tr key={app.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <strong>{app.user_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{app.user_email}</div>
                        {app.official_email && <div style={{ fontSize: '0.72rem', color: '#0284c7' }}>Off: {app.official_email}</div>}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div>{app.organization || 'Independent'}</div>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{app.designation || 'Staff'}</span>
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: 700, color: '#0369a1' }}>
                        {app.requested_region || 'Unassigned'}
                      </td>
                      <td style={{ padding: '12px 10px', maxWidth: '280px', color: '#334155' }}>
                        "{app.reason}"
                        {app.supporting_evidence && (
                          <div style={{ fontSize: '0.74rem', color: '#0284c7', marginTop: '4px' }}>
                            Ref: {app.supporting_evidence}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => openConfirmModal(app, 'approve')}
                          className="btn"
                          style={{
                            padding: '6px 12px',
                            background: '#16a34a',
                            color: '#fff',
                            border: '1.5px solid #111',
                            marginRight: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800
                          }}
                        >
                          Approve & Assign
                        </button>
                        <button
                          onClick={() => openConfirmModal(app, 'reject')}
                          className="btn"
                          style={{
                            padding: '6px 10px',
                            background: '#ef4444',
                            color: '#fff',
                            border: '1.5px solid #111',
                            fontSize: '0.78rem',
                            fontWeight: 800
                          }}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Regional Allocations (Superadmin) */}
      {activeTab === 'regions' && isSuperadmin && (
        <div className="glass-card" style={{ padding: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 900 }}>
            Geographic Regional Assignments
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111', textAlign: 'left' }}>
                  <th style={{ padding: '10px', fontWeight: 800 }}>Region Name</th>
                  <th style={{ padding: '10px', fontWeight: 800 }}>Assigned Admin</th>
                  <th style={{ padding: '10px', fontWeight: 800 }}>Center Coordinates</th>
                  <th style={{ padding: '10px', fontWeight: 800 }}>Radius</th>
                  <th style={{ padding: '10px', fontWeight: 800 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {allRegions.map((reg) => (
                  <tr key={reg.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px', fontWeight: 700 }}>{reg.region_name}</td>
                    <td style={{ padding: '10px' }}>{reg.admin_name} ({reg.admin_email})</td>
                    <td style={{ padding: '10px' }}><code>{reg.center_latitude.toFixed(4)}, {reg.center_longitude.toFixed(4)}</code></td>
                    <td style={{ padding: '10px' }}><strong>{reg.radius_km} km</strong></td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        background: reg.is_active ? '#dcfce7' : '#fee2e2',
                        color: reg.is_active ? '#166534' : '#b91c1c'
                      }}>
                        {reg.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="glass-card" style={{ padding: '24px', background: '#ffffff', border: '3px solid #111111', boxShadow: '5px 5px 0px #111111' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 900 }}>
            Security Audit Trail
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #111', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 800 }}>Timestamp</th>
                  <th style={{ padding: '8px 10px', fontWeight: 800 }}>Action</th>
                  <th style={{ padding: '8px 10px', fontWeight: 800 }}>Actor ID</th>
                  <th style={{ padding: '8px 10px', fontWeight: 800 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0369a1' }}>
                      <code>{log.action}</code>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#475569' }}>
                      {log.actor_id ? log.actor_id.substring(0, 8) + '...' : 'System'}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#334155' }}>
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Superadmin Approval Modal with Regional Assignment Inputs */}
      {selectedApp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '4px solid #111111',
            borderRadius: '12px',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            boxShadow: '8px 8px 0px #111111'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
                {actionType === 'approve' ? 'Approve & Assign Region' : 'Reject Access Request'}
              </h3>
              <button onClick={closeConfirmModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem', color: '#475569' }}>
              Applicant: <strong>{selectedApp.user_name}</strong> ({selectedApp.user_email})
            </p>

            {modalFeedback && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1.5px solid #ef4444', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '14px' }}>
                {modalFeedback.text}
              </div>
            )}

            {actionType === 'approve' && (
              <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '2px solid #111' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.92rem', fontWeight: 900 }}>Geographic Regional Boundary</h4>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Region / Ward Name *</label>
                  <input
                    type="text"
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', border: '2px solid #111', borderRadius: '4px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, marginBottom: '3px' }}>Center Lat *</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={centerLat}
                      onChange={(e) => setCenterLat(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '2px solid #111', borderRadius: '4px', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, marginBottom: '3px' }}>Center Lon *</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={centerLon}
                      onChange={(e) => setCenterLon(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '2px solid #111', borderRadius: '4px', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, marginBottom: '3px' }}>Radius (km) *</label>
                    <input
                      type="number"
                      step="0.5"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', border: '2px solid #111', borderRadius: '4px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Administrative Review Note</label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Optional review justification..."
                style={{ width: '100%', padding: '8px 10px', border: '2px solid #111', borderRadius: '6px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={closeConfirmModal} className="btn btn-secondary" style={{ padding: '8px 14px' }}>Cancel</button>
              <button
                onClick={handleConfirmReview}
                disabled={actionSubmitting}
                className="btn btn-primary"
                style={{ padding: '8px 18px', background: actionType === 'approve' ? '#16a34a' : '#ef4444' }}
              >
                {actionSubmitting ? 'Processing...' : (actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Large Image Preview Modal */}
      {previewImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '4px solid #111111',
            borderRadius: '12px',
            maxWidth: '720px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '10px 10px 0px #111111'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>
                {previewImage.title}
              </h3>
              <button onClick={() => setPreviewImage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* High Res Image */}
            <div style={{ height: '320px', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              <img
                src={previewImage.view_url || 'https://via.placeholder.com/600x400?text=Private+S3+Image'}
                alt={previewImage.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* Telemetry Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1.5px solid #111' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800 }}>ESTIMATED DEPTH</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0284c7' }}>
                  {previewImage.estimated_depth_cm !== null ? `${previewImage.estimated_depth_cm} cm` : 'N/A'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1.5px solid #111' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800 }}>RISK STATUS</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: previewImage.estimated_depth_cm >= 30 ? '#ef4444' : '#16a34a' }}>
                  {previewImage.yolo_results?.risk_level || 'Normal'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1.5px solid #111' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800 }}>COORDINATES</span>
                <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                  {previewImage.latitude.toFixed(4)}, {previewImage.longitude.toFixed(4)}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#334155', marginBottom: '16px', lineHeight: 1.4 }}>
              {previewImage.description || 'No field description.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Uploaded by {previewImage.uploader_name} on {new Date(previewImage.created_at).toLocaleString()}
              </span>
              <button
                onClick={() => setPreviewImage(null)}
                className="btn btn-secondary"
                style={{ padding: '6px 16px' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, RefreshCw, ArrowLeft } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '16px'
      }}>
        <RefreshCw size={36} color="#06b6d4" style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Verifying Security Credentials...
        </span>
      </div>
    );
  }

  if (!user) {
    // Redirect unauthenticated visitor to login, preserving intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role restrictions if allowedRoles provided
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
}

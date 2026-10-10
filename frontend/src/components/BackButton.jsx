import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ to, label = "Back", style = {} }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button
      onClick={handleBack}
      className="back-btn-theme"
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: '#ffffff',
        color: '#111111',
        border: '2px solid #111111',
        borderRadius: '8px',
        padding: '7px 14px',
        fontSize: '0.86rem',
        fontWeight: 800,
        cursor: 'pointer',
        boxShadow: '3px 3px 0px #111111',
        transition: 'all 0.15s ease',
        marginBottom: '16px',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translate(-1px, -1px)';
        e.currentTarget.style.boxShadow = '4px 4px 0px #111111';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '3px 3px 0px #111111';
      }}
    >
      <ArrowLeft size={16} strokeWidth={2.5} />
      <span>{label}</span>
    </button>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, MapPin, Navigation, ArrowRight, ShieldAlert, Cpu, Activity, Waves } from 'lucide-react';

export default function Home() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', padding: '40px 10px 50px 10px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '30px',
          background: 'rgba(6, 182, 212, 0.1)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          color: '#38bdf8',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '24px'
        }}>
          <Activity size={14} className="pulse-dot" />
          <span>Environmental Hacks 2026 • Track 02: Heat & Water</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(2.4rem, 5vw, 3.6rem)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          margin: '0 auto 20px auto',
          maxWidth: '850px',
          background: 'linear-gradient(180deg, #ffffff 30%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          CV-Powered Waterlogging Depth Gauge & Hazard Alert
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: '720px',
          margin: '0 auto 36px auto',
          lineHeight: 1.6
        }}>
          During monsoons, opaque floodwater conceals true depth until vehicles submerge. 
          FloodVision extracts vehicle wheel baselines with YOLOv8 to mathematically gauge water depth 
          and escalate critical <strong>30 cm</strong> engine-kill thresholds in real time.
        </p>

        {/* Quick CTA Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <Link to="/analyze" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
            <Camera size={18} />
            <span>Analyze Flooded Road</span>
            <ArrowRight size={16} />
          </Link>
          <Link to="/map" className="btn btn-secondary" style={{ padding: '14px 24px', fontSize: '1rem' }}>
            <MapPin size={18} color="#38bdf8" />
            <span>Open Live Flood Map</span>
          </Link>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '60px'
      }}>
        {/* Card 1: Gauge Depth */}
        <div className="glass-card glass-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: 'rgba(2, 132, 199, 0.15)',
            border: '1px solid rgba(2, 132, 199, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px'
          }}>
            <Camera size={24} color="#38bdf8" />
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', color: '#f8fafc' }}>
            CV Water Depth Gauge
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, marginBottom: '20px' }}>
            Upload any street photo. Our neural network segments car chassis and calibrates visible wheel proportions 
            against standard 65 cm tire baselines to estimate water depth in centimeters.
          </p>
          <Link to="/analyze" className="btn btn-primary" style={{ width: '100%' }}>
            <span>Launch Analyzer</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Card 2: Live GIS Map */}
        <div className="glass-card glass-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px'
          }}>
            <MapPin size={24} color="#34d399" />
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', color: '#f8fafc' }}>
            Live GIS Hazard Map
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, marginBottom: '20px' }}>
            Track real-time crowdsourced flood incidents. Color-coded markers distinguish safe puddles 
            from high-risk arterial underpasses and critical engine-stall water levels.
          </p>
          <Link to="/map" className="btn btn-emerald" style={{ width: '100%' }}>
            <span>View Live Map</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Card 3: Safe Route Planner */}
        <div className="glass-card glass-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: 'rgba(124, 58, 237, 0.15)',
            border: '1px solid rgba(124, 58, 237, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px'
          }}>
            <Navigation size={24} color="#a78bfa" />
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', color: '#f8fafc' }}>
            Safe Flood-Free Routing
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, marginBottom: '20px' }}>
            Calculate safe detours that actively bypass roads where water depth exceeds vehicle clearance, 
            protecting battery packs and combustion engines from hydro-locking.
          </p>
          <Link to="/routes" className="btn btn-purple" style={{ width: '100%' }}>
            <span>Plan Safe Route</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Architecture Spec Strip */}
      <div className="glass-card" style={{ padding: '30px', textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.85rem' }}>
          Production Edge-to-Cloud Pipeline
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>65 cm</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nominal Tire Diameter Baseline</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>30 cm</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Critical Engine Stall Threshold</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399', fontFamily: 'var(--font-mono)' }}>YOLOv8</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vehicle Submersion Truncation</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>AWS Cloud</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>S3 + DynamoDB + SNS Escalation</div>
          </div>
        </div>
      </div>
    </div>
  );
}

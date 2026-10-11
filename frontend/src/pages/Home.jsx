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
          padding: '8px 18px',
          borderRadius: '24px',
          background: '#FFCE32',
          border: '2px solid #111111',
          boxShadow: '3px 3px 0px #111111',
          color: '#111111',
          fontSize: '0.84rem',
          fontWeight: 800,
          marginBottom: '24px'
        }}>
          <Activity size={15} color="#111111" />
          <span>Environmental Hacks 2026 • Track 02: Heat & Water</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(2.4rem, 5vw, 3.6rem)',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          margin: '0 auto 20px auto',
          maxWidth: '850px',
          color: '#111111'
        }}>
          CV-Powered Waterlogging Depth Gauge & Hazard Alert
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: '#334155',
          maxWidth: '720px',
          margin: '0 auto 36px auto',
          lineHeight: 1.6,
          fontWeight: 500
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
            <MapPin size={18} color="#0284c7" />
            <span>Open Live Flood Map</span>
          </Link>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '48px'
      }}>
        {/* Card 1: Gauge Depth */}
        <div className="glass-card glass-card-hover" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '10px',
            background: '#e0f2fe',
            border: '2px solid #111111',
            boxShadow: '2px 2px 0px #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px'
          }}>
            <Camera size={24} color="#0284c7" />
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 800, color: '#111111' }}>
            CV Water Depth Gauge
          </h3>
          <p style={{ color: '#475569', lineHeight: 1.5, flex: 1, marginBottom: '20px', fontSize: '0.95rem' }}>
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
            borderRadius: '10px',
            background: '#dcfce7',
            border: '2px solid #111111',
            boxShadow: '2px 2px 0px #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px'
          }}>
            <MapPin size={24} color="#16a34a" />
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 800, color: '#111111' }}>
            Live GIS Hazard Map
          </h3>
          <p style={{ color: '#475569', lineHeight: 1.5, flex: 1, marginBottom: '20px', fontSize: '0.95rem' }}>
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
            borderRadius: '10px',
            background: '#f3e8ff',
            border: '2px solid #111111',
            boxShadow: '2px 2px 0px #111111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px'
          }}>
            <Navigation size={24} color="#9333ea" />
          </div>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 800, color: '#111111' }}>
            Safe Flood-Free Routing
          </h3>
          <p style={{ color: '#475569', lineHeight: 1.5, flex: 1, marginBottom: '20px', fontSize: '0.95rem' }}>
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
        <h4 style={{ margin: '0 0 20px 0', color: '#111111', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.88rem' }}>
          Production Edge-to-Cloud Pipeline
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-mono)' }}>65 cm</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Nominal Tire Diameter Baseline</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>30 cm</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Critical Engine Stall Threshold</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a', fontFamily: 'var(--font-mono)' }}>YOLOv8</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Vehicle Submersion Truncation</div>
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#9333ea', fontFamily: 'var(--font-mono)' }}>AWS Cloud</div>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>S3 + DynamoDB + SNS Escalation</div>
          </div>
        </div>
      </div>
    </div>
  );
}

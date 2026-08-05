import React, { useState, useEffect } from 'react';

interface DashboardProps {
  onLaunchPipeline: (view: 'cropper' | 'batch' | 'generator' | 'chat') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLaunchPipeline }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toISOString().split('T')[1].split('.')[0]; // UTC time

  return (
    <>
      <div className="ambient"></div>
      <nav>
          <div className="logo">CARDCROP // SYSTEM_UI</div>
          <div style={{fontFamily: "'Geist Mono', monospace", fontSize: "0.7rem"}}>
              UTC: {timeString} <span style={{color: "var(--accent)", marginLeft: "1rem"}}>● LIVE</span>
          </div>
      </nav>

      <div className="app-grid">
          <div className="pane pane-hero">
              <div>
                  <span className="meta-label">Overview</span>
                  <h1 className="hero-title">Automated Vision Engine</h1>
              </div>
              <p className="hero-desc">
                  Enterprise-grade AI suite for high-volume trading card digitization. Optimized for TCG, Sports, and Collectible assets.
              </p>
              <div style={{marginTop: "auto", borderTop: "1px solid var(--ink-border)", paddingTop: "2rem"}}>
                  <span className="meta-label">Architecture</span>
                  <p style={{fontSize: "0.75rem", fontFamily: "'Geist Mono', monospace"}}>DISTRIBUTED_NODE_V4</p>
              </div>
          </div>

          <div className="pane pane-main">
              <span className="meta-label" style={{marginBottom: "1.5rem"}}>Functional Modules</span>
              <div className="grid-layout">
                  <div className="module-card">
                      <span className="meta-label">0x01</span>
                      <h3 className="module-name">Batch Auto-Crop</h3>
                      <p className="module-info">Intelligent detection of card boundaries with automated skew correction and rotation normalization.</p>
                      <button onClick={() => onLaunchPipeline('batch')} className="module-btn">Launch Pipeline</button>
                  </div>
                  <div className="module-card">
                      <span className="meta-label">0x02</span>
                      <h3 className="module-name">Neural Upscale</h3>
                      <p className="module-info">Generative refinement for vintage assets. Enhances surface textures while preserving holographic patterns.</p>
                      <button onClick={() => onLaunchPipeline('cropper')} className="module-btn">Launch Pipeline</button>
                  </div>
                  <div className="module-card">
                      <span className="meta-label">0x03</span>
                      <h3 className="module-name">Edge Analysis</h3>
                      <p className="module-info">Sub-pixel measurements for card centering. High-precision corner radius assessment and grading prep.</p>
                      <button onClick={() => onLaunchPipeline('cropper')} className="module-btn">Launch Pipeline</button>
                  </div>
                  <div className="module-card">
                      <span className="meta-label">0x04</span>
                      <h3 className="module-name">Custom Export</h3>
                      <p className="module-info">Define resolution tiers, naming logic based on OCR detection, and cloud destination pathways.</p>
                      <button onClick={() => onLaunchPipeline('cropper')} className="module-btn">Launch Pipeline</button>
                  </div>
              </div>
          </div>

          <div className="pane pane-system">
              <span className="meta-label">Global Telemetry</span>
              <div className="data-row">
                  <span className="meta-label" style={{fontSize: "0.5rem"}}>Thruput / Day</span>
                  <span className="data-val">14.2M <small style={{fontSize: "0.6rem"}}>ITEMS</small></span>
              </div>
              <div className="data-row">
                  <span className="meta-label" style={{fontSize: "0.5rem"}}>Model Precision</span>
                  <span className="data-val">99.82%</span>
              </div>
              <div className="data-row">
                  <span className="meta-label" style={{fontSize: "0.5rem"}}>Latent Latency</span>
                  <span className="data-val">14ms</span>
              </div>
          </div>
      </div>

      <footer>
          <div>BUILD_REF: FF-992-XC</div>
          <div style={{display: "flex", gap: "2rem"}}>
              <span>ENCRYPTED_SSL</span>
              <span>AUTO_SAVE: <span className="tag">ON</span></span>
              <span>REGION: US-EAST-1</span>
          </div>
      </footer>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import './scientificPlotModal.css';

/**
 * ScientificPlotModal — Full-Screen High-Resolution GIS & Simulation Plot Inspector
 * 
 * Provides interactive inspection, zoom, and metadata view for authentic
 * simulation hydrographs, breach parameter charts, and GIS flood inundation maps.
 */
export default function ScientificPlotModal({ plot, onClose }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    // Lock scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!plot) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.3, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.3, 0.7));
  const handleResetZoom = () => setZoomLevel(1);

  const handleCopyCitation = () => {
    const citation = `PRALAYA 2D Hydrodynamic Simulation Output: ${plot.title} — ${plot.subtitle}. Source: SIH-2026 Engine.`;
    navigator.clipboard.writeText(citation);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="sci-modal-overlay" onClick={onClose}>
      <div className="sci-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="sci-modal-header">
          <div className="sci-modal-title-wrap">
            <div className="sci-modal-tags">
              <span className="sci-tag-cat">{plot.category || 'HYDRODYNAMICS'}</span>
              <span className="sci-tag-badge">{plot.tag || 'VALIDATED'}</span>
              <span className="sci-tag-source">DIRECT PIPELINE OUTPUT</span>
            </div>
            <h2 className="sci-modal-title">{plot.title}</h2>
            <p className="sci-modal-subtitle">{plot.subtitle}</p>
          </div>

          <div className="sci-modal-actions">
            {/* Zoom controls */}
            <div className="sci-zoom-controls">
              <button
                type="button"
                className="sci-ctrl-btn"
                onClick={handleZoomOut}
                title="Zoom Out"
                disabled={zoomLevel <= 0.7}
              >
                −
              </button>
              <span className="sci-zoom-val">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                className="sci-ctrl-btn"
                onClick={handleZoomIn}
                title="Zoom In"
                disabled={zoomLevel >= 2.5}
              >
                +
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  className="sci-ctrl-btn sci-reset-btn"
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Download Link */}
            <a
              href={plot.image}
              download={plot.image.split('/').pop()}
              className="sci-action-btn sci-btn-download"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>Download Hi-Res</span>
            </a>

            {/* Close Button */}
            <button
              type="button"
              className="sci-close-btn"
              onClick={onClose}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body with Pan/Zoom Canvas */}
        <div className="sci-modal-viewport">
          <div
            className="sci-modal-image-container"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <img
              src={plot.image}
              alt={plot.title}
              className="sci-modal-img"
              loading="eager"
            />
          </div>
        </div>

        {/* Footer Metrics & Description Bar */}
        <div className="sci-modal-footer">
          <div className="sci-modal-desc">
            <span className="sci-desc-label">SCIENTIFIC METHODOLOGY & CONTEXT</span>
            <p>{plot.description}</p>
          </div>

          {plot.metrics && plot.metrics.length > 0 && (
            <div className="sci-metrics-grid">
              {plot.metrics.map((m, i) => (
                <div key={i} className="sci-metric-pill">
                  <span className="sci-metric-lbl">{m.label}</span>
                  <span className="sci-metric-val">{m.val}</span>
                </div>
              ))}
            </div>
          )}

          <div className="sci-footer-bottom">
            <span className="sci-pipeline-credit">
              Generated via PRALAYA Hydrodynamic Engine · SIH-2026 Precision Benchmark
            </span>
            <button
              type="button"
              className="sci-cite-btn"
              onClick={handleCopyCitation}
            >
              {isCopied ? '✓ Citation Copied!' : 'Copy Citation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

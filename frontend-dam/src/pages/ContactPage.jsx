import React, { useState } from 'react';
import SectionLabel from '../components/SectionLabel';
import { ShieldCheckIcon, AlertIcon, BuildingIcon, LocationIcon } from '../components/Icons';
import './pages.css';

/**
 * Contact & Emergency Operations Portal
 * Enables State Disaster Management Authorities to request API credentials,
 * report dam anomalies, and coordinate early warning dispatches.
 * Zero emojis, 100% SVG iconography.
 */
export default function ContactPage({ onBackToHome }) {
  const [formData, setFormData] = useState({
    name: '',
    agency: '',
    email: '',
    damTarget: 'Machhu-II Dam (Gujarat)',
    requestType: 'GIS GeoTIFF API Access',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="pralaya-subpage">
      <div className="container subpage-container">
        {/* Top Breadcrumb */}
        <div className="subpage-top-nav">
          <button type="button" className="back-to-home-btn" onClick={onBackToHome}>
            ← RETURN TO HOME
          </button>
          <span className="subpage-meta-tag">OPERATIONS DISPATCH & API ACCESS</span>
        </div>

        {/* Page Header */}
        <div className="subpage-header">
          <SectionLabel
            directive="STATE AGENCY DISPATCH"
            label="CONTACT // EMERGENCY OPERATIONS"
            variant="amber"
          />
          <h1 className="subpage-title">
            Connect with PRALAYA <em>Command Operations.</em>
          </h1>
          <p className="subpage-lede">
            For State Disaster Management Authorities (SDMA), National Disaster Response Force (NDRF),
            and certified dam safety engineers seeking live GIS API feeds or custom digital twin calibration.
          </p>
        </div>

        <div className="contact-grid-layout">
          {/* Left Column: Form */}
          <div className="contact-form-card">
            <h3 className="form-title">Request Geospatial API Credentials / Calibration</h3>
            <p className="form-subtitle">
              Authorized personnel receive direct API access to <code>depth_max.tif</code> rasters and GeoJSON vectors.
            </p>

            {submitted ? (
              <div className="form-success-box">
                <ShieldCheckIcon size={36} color="#86efac" />
                <h4>Request Successfully Logged</h4>
                <p>
                  Your credentials request for <strong>{formData.damTarget}</strong> has been routed
                  to the PRALAYA Operations Dispatch desk. An automated cryptographic key will be dispatched
                  to <strong>{formData.email}</strong> following institutional verification.
                </p>
                <button
                  type="button"
                  className="subpage-cta-btn"
                  style={{ marginTop: '16px' }}
                  onClick={() => setSubmitted(false)}
                >
                  SUBMIT ANOTHER REQUEST
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pralaya-contact-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Er. Rajiv Patel"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation & Agency</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Gujarat SDMA / Executive Engineer"
                      value={formData.agency}
                      onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Official Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rajiv.patel@gov.in"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Dam Reservoir</label>
                    <select
                      value={formData.damTarget}
                      onChange={(e) => setFormData({ ...formData, damTarget: e.target.value })}
                    >
                      <option value="Machhu-II Dam (Gujarat)">Machhu-II Dam (Gujarat)</option>
                      <option value="Teesta III Dam (Sikkim)">Teesta III Dam (Sikkim)</option>
                      <option value="Tiware Dam (Maharashtra)">Tiware Dam (Maharashtra)</option>
                      <option value="Karam Dam (Madhya Pradesh)">Karam Dam (Madhya Pradesh)</option>
                      <option value="Idukki Reservoir Complex (Kerala)">Idukki Reservoir Complex (Kerala)</option>
                      <option value="Custom Reservoir Hydrodynamic Twin">Custom Reservoir Hydrodynamic Twin</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Service / Dataset Required</label>
                  <select
                    value={formData.requestType}
                    onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                  >
                    <option value="GIS GeoTIFF API Access">GIS GeoTIFF & Vector API Endpoints</option>
                    <option value="Custom Dam 3D Digital Twin Calibration">Custom Dam 3D Digital Twin Calibration</option>
                    <option value="Emergency Warning Routing Integration">Emergency Warning Routing Integration</option>
                    <option value="Academic Research & Ground Truth Data">Academic Research & Ground Truth Benchmark Data</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Operational Note / Incident Brief</label>
                  <textarea
                    rows={4}
                    placeholder="Specify coordinate bounding boxes or required upstream rainfall hydrographs..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <button type="submit" className="subpage-cta-btn">
                  SUBMIT OPERATIONAL REQUEST →
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Emergency Directory */}
          <div className="contact-sidebar">
            <div className="emergency-hotline-card">
              <div className="hotline-tag">
                <AlertIcon size={14} color="#fde047" />
                <span>24/7 EARLY WARNING DISPATCH</span>
              </div>
              <h3>National Operations Liaison</h3>
              <p>Direct priority line for State Relief Commissioners and Dam Safety Organization nodal officers:</p>
              <div className="hotline-number">+91 (11) 2436-3260</div>
              <div className="hotline-sub">SECURE DISPATCH // LEVEL 1 PRIORITY</div>
            </div>

            <div className="regional-offices-card">
              <h4>Regional Nodal Centers</h4>
              <div className="office-item">
                <div className="office-header">
                  <LocationIcon size={14} color="#3fa89b" />
                  <strong>Western Basin (Gujarat & Rajasthan)</strong>
                </div>
                <p>State Emergency Operations Centre, Sector 10A, Gandhinagar, Gujarat</p>
              </div>

              <div className="office-item">
                <div className="office-header">
                  <LocationIcon size={14} color="#3fa89b" />
                  <strong>Himalayan Cryosphere (Sikkim & Uttarakhand)</strong>
                </div>
                <p>Glacial Hazard Monitoring Cell, Dehradun & Gangtok</p>
              </div>

              <div className="office-item">
                <div className="office-header">
                  <LocationIcon size={14} color="#3fa89b" />
                  <strong>Peninsular Basins (Maharashtra & Kerala)</strong>
                </div>
                <p>Southern River Command & Hydro-meteorological Observatory, Kochi</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

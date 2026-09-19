import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FloodProgressionData, SimulationSummary, ShelterInfo } from '../../types/simulation';
import { FloodStatsCard } from './FloodStatsCard';
import { MonitoringGaugesCard } from './MonitoringGaugesCard';
import { HydrographCard } from './HydrographCard';
import { SafeSheltersCard, SHELTERS } from './SafeSheltersCard';

interface GisMap2DProps {
  floodData: FloodProgressionData;
  summary: SimulationSummary;
  currentTime: number;
  layers: {
    flood: boolean;
    evacuation: boolean;
    shelters: boolean;
    routes: boolean;
  };
}

export const GisMap2D: React.FC<GisMap2DProps> = ({
  floodData,
  summary,
  currentTime,
  layers,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const contourGroupRef = useRef<L.LayerGroup | null>(null);
  const evacGroupRef = useRef<L.LayerGroup | null>(null);
  const shelterGroupRef = useRef<L.LayerGroup | null>(null);
  const routeGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.865, 70.840],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // World Imagery Satellite Tiles
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
      }
    ).addTo(map);

    // Scale Bar bottom-right (matches Image 2)
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    // 1. Machhu-2 Dam Pin (Matching Image 2)
    const damIcon = L.divIcon({
      className: '',
      html: `
        <div class="dam-marker-pin">
          <div class="dam-pulse-core"></div>
          <div class="dam-label-tag">Machhu-2</div>
        </div>
      `,
      iconSize: [90, 36],
      iconAnchor: [45, 10],
    });
    L.marker([22.758, 70.887], { icon: damIcon }).addTo(map);

    // 2. Morbi City Pin (Matching Image 2)
    const morbiIcon = L.divIcon({
      className: '',
      html: `<div class="city-label-tag">🏙️ Morbi</div>`,
      iconSize: [80, 28],
      iconAnchor: [40, 14],
    });
    L.marker([22.818, 70.835], { icon: morbiIcon }).addTo(map);

    // Layer Groups
    const contourGroup = L.layerGroup().addTo(map);
    contourGroupRef.current = contourGroup;

    const evacGroup = L.layerGroup().addTo(map);
    evacGroupRef.current = evacGroup;

    const shelterGroup = L.layerGroup().addTo(map);
    shelterGroupRef.current = shelterGroup;

    const routeGroup = L.layerGroup().addTo(map);
    routeGroupRef.current = routeGroup;

    // Build Evacuation Zone (Morbi core)
    const evacPolygon: [number, number][] = [
      [22.835, 70.825],
      [22.838, 70.845],
      [22.812, 70.852],
      [22.805, 70.832],
      [22.815, 70.820],
    ];
    L.polygon(evacPolygon, {
      color: '#ef4444',
      weight: 2,
      dashArray: '6, 6',
      fillColor: 'rgba(239, 68, 68, 0.22)',
      fillOpacity: 1,
    }).addTo(evacGroup);

    // Build Shelters & Safe Ridge (>52m MSL)
    const ridgePolygon: [number, number][] = [
      [22.825, 70.865],
      [22.855, 70.885],
      [22.885, 70.898],
      [22.915, 70.910],
      [22.910, 70.925],
      [22.870, 70.915],
      [22.835, 70.890],
      [22.815, 70.875],
    ];
    L.polygon(ridgePolygon, {
      color: '#10b981',
      weight: 2,
      dashArray: '4, 4',
      fillColor: 'rgba(16, 185, 129, 0.14)',
      fillOpacity: 1,
    }).addTo(shelterGroup);

    SHELTERS.forEach((s) => {
      const sIcon = L.divIcon({
        className: '',
        html: `
          <div class="shelter-pin-badge">
            <span>🛡️</span>
            <span>${s.name.split(' ')[1] || s.name}</span>
          </div>
        `,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });
      L.marker(s.coords, { icon: sIcon }).addTo(shelterGroup);
    });

    // Fit bounds
    map.fitBounds([
      [22.750, 70.810],
      [22.915, 70.925],
    ], { padding: [30, 30] });

    return () => {
      map.remove();
    };
  }, []);

  // Update Concentric Contours on Time Change
  useEffect(() => {
    const group = contourGroupRef.current;
    if (!group || !layers.flood) {
      group?.clearLayers();
      return;
    }

    group.clearLayers();

    const steps = floodData.steps;
    const activeSteps = steps.filter((s) => s.time_hours <= currentTime && s.polygon && s.polygon.length > 0);
    if (activeSteps.length === 0) return;

    const milestones = [1.0, 3.0, 6.0, 12.0, 24.0];
    const stepsToDraw: typeof activeSteps = [];

    milestones.forEach((mTime) => {
      if (mTime <= currentTime) {
        let closest = null;
        let minDiff = 999;
        activeSteps.forEach((s) => {
          const diff = Math.abs(s.time_hours - mTime);
          if (diff < minDiff && diff < 1.5) {
            minDiff = diff;
            closest = s;
          }
        });
        if (closest && !stepsToDraw.includes(closest)) {
          stepsToDraw.push(closest);
        }
      }
    });

    const latest = activeSteps[activeSteps.length - 1];
    if (!stepsToDraw.includes(latest)) {
      stepsToDraw.push(latest);
    }

    stepsToDraw.sort((a, b) => b.time_hours - a.time_hours);
    const numBands = stepsToDraw.length;

    stepsToDraw.forEach((step, idx) => {
      const norm = numBands > 1 ? idx / (numBands - 1) : 0;

      let fillColor = '#38bdf8';
      let strokeColor = '#22d3ee';
      let weight = 2.5;
      let fillOpacity = 0.38;

      if (idx === 0) {
        // Outermost advancing wavefront (Image 2 T+1hr cyan)
        fillColor = '#38bdf8';
        strokeColor = '#22d3ee';
        weight = 2.5;
        fillOpacity = 0.38;
      } else if (norm < 0.4) {
        fillColor = '#0284c7';
        strokeColor = '#38bdf8';
        weight = 1.8;
        fillOpacity = 0.55;
      } else if (norm < 0.75) {
        fillColor = '#0e4194';
        strokeColor = '#0ea5e9';
        weight = 1.5;
        fillOpacity = 0.72;
      } else {
        // Deepest midnight navy pool (Image 2 T+24hr)
        fillColor = '#08235a';
        strokeColor = '#1d4ed8';
        weight = 1.5;
        fillOpacity = 0.88;
      }

      const geoJsonFeature = {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: step.polygon!,
        },
        properties: {},
      };

      const poly = L.geoJSON(geoJsonFeature, {
        style: {
          fillColor,
          fillOpacity,
          color: strokeColor,
          weight,
          opacity: 0.95,
        },
      });

      group.addLayer(poly);

      // Milestone time pin (Image 2: T+1hr, T+3hr, T+6hr, T+12hr, T+24hr)
      if (step.lead_coords) {
        const lat = Array.isArray(step.lead_coords) ? step.lead_coords[0] : step.lead_coords.lat;
        const lng = Array.isArray(step.lead_coords) ? step.lead_coords[1] : step.lead_coords.lng;
        if (lat != null && lng != null) {
          const timeStr = `T+${Math.round(step.time_hours)}hr`;
          const pin = L.divIcon({
            className: '',
            html: `<div class="contour-label">${timeStr}</div>`,
            iconSize: [44, 18],
            iconAnchor: [22, 9],
          });
          group.addLayer(L.marker([lat, lng], { icon: pin }));
        }
      }
    });
  }, [currentTime, floodData, layers.flood]);

  // Layer toggle visibility
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (evacGroupRef.current) {
      if (layers.evacuation && !map.hasLayer(evacGroupRef.current)) map.addLayer(evacGroupRef.current);
      if (!layers.evacuation && map.hasLayer(evacGroupRef.current)) map.removeLayer(evacGroupRef.current);
    }
    if (shelterGroupRef.current) {
      if (layers.shelters && !map.hasLayer(shelterGroupRef.current)) map.addLayer(shelterGroupRef.current);
      if (!layers.shelters && map.hasLayer(shelterGroupRef.current)) map.removeLayer(shelterGroupRef.current);
    }
  }, [layers]);

  const handleSelectShelter = (s: ShelterInfo) => {
    if (mapRef.current) {
      mapRef.current.flyTo(s.coords, 14, { duration: 1.2 });
    }
  };

  return (
    <div className="gis-map-container">
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* Floating Left Column HUD Cards (Matching Image 2) */}
      <aside className="hud-column" id="hud-panels">
        <FloodStatsCard summary={summary} />
        <MonitoringGaugesCard summary={summary} />
        <HydrographCard summary={summary} currentTime={currentTime} />
        <SafeSheltersCard onSelectShelter={handleSelectShelter} />
      </aside>
    </div>
  );
};

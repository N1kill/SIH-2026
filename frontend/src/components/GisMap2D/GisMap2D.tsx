import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import 'leaflet/dist/leaflet.css';
import type {
  FloodProgressionData,
  SimulationMapData,
  SimulationSummary,
  ShelterInfo,
} from '../../types/simulation';
import { FloodStatsCard } from './FloodStatsCard';
import { MonitoringGaugesCard } from './MonitoringGaugesCard';
import { HydrographCard } from './HydrographCard';
import { SafeSheltersCard } from './SafeSheltersCard';

interface GisMap2DProps {
  floodData: FloodProgressionData;
  summary: SimulationSummary;
  mapData: SimulationMapData;
  currentTime: number;
  layers: {
    flood: boolean;
    evacuation: boolean;
    shelters: boolean;
    routes: boolean;
  };
}

function asGeoJson(value: unknown): GeoJsonObject {
  return value as GeoJsonObject;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] ?? char);
}

export const GisMap2D: React.FC<GisMap2DProps> = ({
  floodData,
  summary,
  mapData,
  currentTime,
  layers,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const contourGroupRef = useRef<L.LayerGroup | null>(null);
  const riskGroupRef = useRef<L.LayerGroup | null>(null);
  const shelterGroupRef = useRef<L.LayerGroup | null>(null);
  const routeGroupRef = useRef<L.LayerGroup | null>(null);

  const facilities = useMemo<ShelterInfo[]>(() => mapData.facilities.features
    .filter((feature) => feature.geometry.type === 'Point')
    .map((feature, index) => {
      const coordinates = feature.geometry.coordinates as [number, number];
      const properties = feature.properties;
      return {
        id: String(properties.id ?? index),
        name: String(properties.name ?? `Facility ${index + 1}`),
        type: String(properties.amenity ?? 'facility'),
        coords: [coordinates[1], coordinates[0]],
        elevation_m: typeof properties.elevation_m === 'number' ? properties.elevation_m : null,
        distance_to_flood_m: typeof properties.distance_to_flood_m === 'number'
          ? properties.distance_to_flood_m : null,
        depth_m: typeof properties.depth_m === 'number' ? properties.depth_m : null,
        status: String(properties.screening_status ?? 'OUTSIDE_MODEL') as ShelterInfo['status'],
      };
    }), [mapData.facilities]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const dam = summary.project;
    const center: L.LatLngExpression = dam ? [dam.latitude, dam.longitude] : [22.7667, 70.8661];
    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18 }
    ).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
    const paneOrder = [
      ['candidateRefuges', 350],
      ['floodExtent', 410],
      ['priorityZones', 420],
      ['evacuationRoutes', 430],
      ['facilityMarkers', 440],
    ] as const;
    paneOrder.forEach(([name, zIndex]) => {
      map.createPane(name);
      const pane = map.getPane(name);
      if (pane) pane.style.zIndex = String(zIndex);
    });

    const damIcon = L.divIcon({
      className: '',
      html: `<div class="dam-marker-pin"><div class="dam-pulse-core"></div><div class="dam-label-tag">${escapeHtml(dam?.dam_name ?? 'Dam')}</div></div>`,
      iconSize: [110, 36],
      iconAnchor: [55, 10],
    });
    L.marker(center, { icon: damIcon }).addTo(map);

    const contourGroup = L.layerGroup().addTo(map);
    const riskGroup = L.layerGroup().addTo(map);
    const shelterGroup = L.layerGroup().addTo(map);
    const routeGroup = L.layerGroup().addTo(map);
    contourGroupRef.current = contourGroup;
    riskGroupRef.current = riskGroup;
    shelterGroupRef.current = shelterGroup;
    routeGroupRef.current = routeGroup;

    L.geoJSON(asGeoJson(mapData.safeZones), {
      pane: 'candidateRefuges',
      style: { color: '#10b981', weight: 1.5, dashArray: '4, 4',
        fillColor: '#10b981', fillOpacity: 0.1 },
    }).bindPopup('Facility-centered candidate refuge — not an official safety designation')
      .addTo(shelterGroup);

    L.geoJSON(asGeoJson(mapData.evacuationRoutes), {
      pane: 'evacuationRoutes',
      style: { color: '#fbbf24', weight: 4, opacity: 0.95, dashArray: '8, 5' },
    }).bindPopup('Verified evacuation route').addTo(routeGroup);

    facilities.forEach((facility) => {
      const color = facility.status === 'CANDIDATE' ? '#10b981'
        : facility.status === 'EXPOSED' ? '#ef4444' : '#f59e0b';
      L.circleMarker(facility.coords, {
        pane: 'facilityMarkers',
        radius: 5,
        color: '#0f172a',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .bindTooltip(escapeHtml(facility.name), { direction: 'top' })
        .bindPopup(`<strong>${escapeHtml(facility.name)}</strong><br>${facility.status.replace('_', ' ')}<br>Candidate facility; not a designated shelter.`)
        .addTo(shelterGroup);
    });

    const focusFeatures = mapData.riskZones.features.length
      ? mapData.riskZones.features : mapData.safeZones.features;
    const boundsLayer = L.geoJSON(asGeoJson({
      type: 'FeatureCollection',
      features: focusFeatures,
    }));
    const bounds = boundsLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });

    return () => { map.remove(); mapRef.current = null; };
  }, [facilities, mapData, summary.project]);

  useEffect(() => {
    const group = contourGroupRef.current;
    if (!group || !layers.flood || currentTime <= 0) { group?.clearLayers(); return; }
    group.clearLayers();
    const active = floodData.steps.filter((step) => step.time_hours <= currentTime && step.features.length);
    if (!active.length) return;
    const latest = active[active.length - 1];
    const featureCollection = { type: 'FeatureCollection', features: latest.features };
    L.geoJSON(asGeoJson(featureCollection), {
      pane: 'floodExtent',
      style: { fillColor: '#0284c7', fillOpacity: 0.5, color: '#22d3ee', weight: 2 },
    }).bindPopup(
      `T+${latest.time_hours.toFixed(2)} h<br>` +
      `${latest.inundated_area_km2.toFixed(3)} km² inundated<br>` +
      `Maximum depth so far: ${latest.max_depth_m.toFixed(2)} m`
    ).addTo(group);
  }, [currentTime, floodData, layers.flood]);

  useEffect(() => {
    const group = riskGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.evacuation || currentTime <= 0) return;
    const elapsedSeconds = currentTime * 3600;
    const arrivedFeatures = mapData.riskZones.features.filter((feature) => {
      const arrival = feature.properties.earliest_arrival_s;
      return typeof arrival === 'number' && arrival <= elapsedSeconds;
    });
    L.geoJSON(asGeoJson({ type: 'FeatureCollection', features: arrivedFeatures }), {
      pane: 'priorityZones',
      style: (feature) => {
        const category = Number(feature?.properties?.category ?? 1);
        const colors = ['#38bdf8', '#facc15', '#f97316', '#ef4444'];
        return { color: colors[Math.max(0, category - 1)], weight: 1.5,
          fillColor: colors[Math.max(0, category - 1)], fillOpacity: 0.18 };
      },
      onEachFeature: (feature, layer) => layer.bindPopup(
        `<strong>${escapeHtml(String(feature.properties?.risk ?? 'Hazard zone'))}</strong><br>` +
        `Max depth: ${Number(feature.properties?.maximum_depth_m ?? 0).toFixed(2)} m<br>` +
        `Earliest arrival: ${(Number(feature.properties?.earliest_arrival_s) / 60).toFixed(1)} min`
      ),
    }).addTo(group);
  }, [currentTime, layers.evacuation, mapData.riskZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const visibility: Array<[L.LayerGroup | null, boolean]> = [
      [riskGroupRef.current, layers.evacuation && currentTime > 0],
      [shelterGroupRef.current, layers.shelters],
      [routeGroupRef.current, layers.routes],
    ];
    visibility.forEach(([group, visible]) => {
      if (!group) return;
      if (visible && !map.hasLayer(group)) map.addLayer(group);
      if (!visible && map.hasLayer(group)) map.removeLayer(group);
    });
  }, [currentTime, layers]);

  const handleSelectShelter = (facility: ShelterInfo) => {
    mapRef.current?.flyTo(facility.coords, 15, { duration: 1.2 });
  };

  return (
    <div className="gis-map-container">
      <div ref={mapContainerRef} className="leaflet-map-canvas" />
      <div className="map-provenance" role="status">
        <strong>SIMULATED</strong>
        <span>Cumulative extent ≥0.1 m · run {floodData.simulation_id.slice(0, 8)}</span>
      </div>
      <aside className="hud-column" id="hud-panels">
        <FloodStatsCard summary={summary} />
        <MonitoringGaugesCard summary={summary} />
        <HydrographCard floodData={floodData} currentTime={currentTime} />
        <SafeSheltersCard
          facilities={facilities}
          zoneStatus={mapData.safeZones.status}
          setbackM={mapData.safeZones.setback_m}
          routeStatus={mapData.evacuationRoutes.status}
          onSelectShelter={handleSelectShelter}
        />
      </aside>
    </div>
  );
};

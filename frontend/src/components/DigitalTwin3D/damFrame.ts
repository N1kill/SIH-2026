/**
 * damFrame.ts
 *
 * Placement frame for the procedural dam model.
 *
 * machhuDamModel.ts builds the dam in a dam-local frame: the dam axis runs along
 * local +X and downstream is local +Z. The surveyed crest
 * (`data/projects/machhu-ii.json` -> `crest_coordinates`) is a bent polyline in
 * projected metres, so the assembled model has to be rotated and translated onto
 * that crest before it is added to the scene. Without the frame the model sits on
 * the z = 0 line while the measured reservoir shoreline follows the real crest,
 * which leaves dry gaps between the dam and the water (widest behind the western
 * abutment).
 *
 * Coordinate contract, shared with the reservoir shoreline in DigitalTwin3D.tsx:
 * local X = metres east of the project dam reference point, local Z = metres north
 * of it. The model's downstream direction (+Z) is therefore geographic north, which
 * is consistent with `downstream_bearing_deg: 330` in the project record.
 *
 * The crest is the source of truth: the crop position, rotation and residual fit
 * error are derived from the project record rather than hard-coded.
 */
import projectRaw from '../../../../data/projects/machhu-ii.json?raw';

export interface DamFrame {
  /** Rotation about Y applied to the dam group. */
  angleRad: number;
  /** Scene position of the dam-local origin (the crop centre). */
  offsetX: number;
  offsetZ: number;
  /** Crest chainage of the crop centre, metres along the crest from its west end. */
  chainageM: number;
  /** Worst |wall - crest| offset inside the crop, metres. */
  crestFitErrorM: number;
  /** Worst distance behind the wall to the measured water edge, metres. */
  maxWaterGapM: number;
}

interface ProjectRecord {
  latitude: number;
  longitude: number;
  dam_height_m: number;
  dam_length_m: number;
  crest_elevation_m: number;
  initial_water_level_m: number;
  maximum_water_level_m: number;
  crest_coordinates: [number, number][];
  provenance?: Array<{ uncertainty?: { crest_alignment_m?: [number, number] } }>;
}

export type LocalPoint = [number, number];

function parseProject(): ProjectRecord {
  const record = JSON.parse(projectRaw) as ProjectRecord;
  const missing: string[] = [];
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

  if (!finite(record.latitude) || !finite(record.longitude)) missing.push('latitude/longitude');
  if (!finite(record.dam_height_m)) missing.push('dam_height_m');
  if (!finite(record.crest_elevation_m)) missing.push('crest_elevation_m');
  if (!finite(record.initial_water_level_m)) missing.push('initial_water_level_m');
  if (!Array.isArray(record.crest_coordinates) || record.crest_coordinates.length < 2) {
    missing.push('crest_coordinates');
  }
  if (missing.length > 0) {
    // Refuse to invent a crest: the dam model must not be placed on a synthetic axis.
    throw new Error(`Project record is missing ${missing.join(', ')}; cannot place the dam model`);
  }
  return record;
}

export const PROJECT = parseProject();

/**
 * Elevation of the dam foundation, from the published crest elevation and the
 * configured structural height. Published project data, not a fitted value.
 */
export const FOUNDATION_ELEVATION_M = PROJECT.crest_elevation_m - PROJECT.dam_height_m;

/** Worst acceptable |wall - crest| offset, from the published crest uncertainty. */
export const CREST_ALIGNMENT_TOLERANCE_M =
  PROJECT.provenance?.find((entry) => entry.uncertainty?.crest_alignment_m)
    ?.uncertainty?.crest_alignment_m?.[1] ?? 40;

export function metresPerDegreeAt(latitudeDeg: number): { perLonDeg: number; perLatDeg: number } {
  return {
    perLonDeg: 111_320 * Math.cos((latitudeDeg * Math.PI) / 180),
    perLatDeg: 111_320,
  };
}

/** Project a geographic position into the scene's local metre frame. */
export function geoToLocalMetres(
  longitude: number,
  latitude: number,
  referenceLongitude: number,
  referenceLatitude: number,
): LocalPoint {
  const { perLonDeg, perLatDeg } = metresPerDegreeAt(referenceLatitude);
  return [
    (longitude - referenceLongitude) * perLonDeg,
    (latitude - referenceLatitude) * perLatDeg,
  ];
}

/** Surveyed crest as a local-metre polyline. */
export function crestLocalPath(): LocalPoint[] {
  return PROJECT.crest_coordinates.map(([longitude, latitude]) =>
    geoToLocalMetres(longitude, latitude, PROJECT.longitude, PROJECT.latitude),
  );
}

/**
 * Convert a dam-local position into scene coordinates under the frame. The dam
 * model is built centred on its local origin, so camera presets and breach framing,
 * which are authored in dam-local coordinates, must pass through this.
 */
export function damLocalToScene(frame: DamFrame, localX: number, localZ: number): { x: number; z: number } {
  const cos = Math.cos(frame.angleRad);
  const sin = Math.sin(frame.angleRad);
  return {
    x: localX * cos + localZ * sin + frame.offsetX,
    z: -localX * sin + localZ * cos + frame.offsetZ,
  };
}

/** Surface height in model metres for a published reservoir water level. */
export function reservoirSurfaceYForLevel(levelM: number, modelDamHeightM: number): number {
  const height = Math.max(levelM - FOUNDATION_ELEVATION_M, 0);
  return Math.min(Math.max(height, 0.4), modelDamHeightM - 0.4);
}

function cross(ax: number, az: number, bx: number, bz: number): number {
  return ax * bz - az * bx;
}

function segmentChainages(path: LocalPoint[]): number[] {
  const chainages = [0];
  for (let i = 1; i < path.length; i++) {
    chainages.push(chainages[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  return chainages;
}

function pointAtChainage(path: LocalPoint[], chainages: number[], chainage: number): LocalPoint {
  const total = chainages[chainages.length - 1];
  const clamped = Math.min(Math.max(chainage, 0), total);
  for (let i = 1; i < chainages.length; i++) {
    if (clamped <= chainages[i]) {
      const span = chainages[i] - chainages[i - 1];
      const t = span > 0 ? (clamped - chainages[i - 1]) / span : 0;
      return [
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      ];
    }
  }
  return path[path.length - 1];
}

/**
 * Distance along `direction` from `origin` to the first measured shoreline edge,
 * capped at `maxProbeM`. Returns the cap when no edge is crossed, which is reported
 * as an unresolved water gap rather than a fabricated one.
 */
function shorelineDistanceAlong(
  origin: LocalPoint,
  direction: LocalPoint,
  outline: LocalPoint[],
  maxProbeM: number,
): number {
  let nearest = maxProbeM;
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i];
    const [bx, bz] = outline[(i + 1) % outline.length];
    const dx = bx - ax;
    const dz = bz - az;
    const denom = cross(direction[0], direction[1], dx, dz);
    if (Math.abs(denom) < 1e-9) continue;
    const wx = ax - origin[0];
    const wz = az - origin[1];
    const t = cross(wx, wz, dx, dz) / denom;
    const u = cross(wx, wz, direction[0], direction[1]) / denom;
    if (t > 1e-6 && t < nearest && u >= 0 && u <= 1) nearest = t;
  }
  return nearest;
}

function outlineCentroid(outline: LocalPoint[]): LocalPoint {
  let x = 0;
  let z = 0;
  for (const [px, pz] of outline) {
    x += px;
    z += pz;
  }
  return [x / outline.length, z / outline.length];
}

/**
 * Place the dam model on the surveyed crest.
 *
 * The crop slides along the crest; a candidate is kept only when the straight wall
 * fits the crest within the published crest-alignment uncertainty, and among those
 * the one leaving the least measured water behind the wall wins. Ties fall back to
 * the smaller fit error, then to the crest chainage nearest the project reference
 * point so the existing spillway-chainage assumption moves as little as possible.
 *
 * The spillway has no surveyed chainage (`spillway_width_m` and
 * `spillway_location_m` are unset in the project record; `spillway_configured` is
 * false), so the crop centre remains a documented display assumption. A straight
 * 600 m wall cannot follow a bent crest exactly; the residual is bounded by
 * CREST_ALIGNMENT_TOLERANCE_M.
 */
export function chooseDamFrame(
  crestPath: LocalPoint[],
  outline: LocalPoint[],
  cropLengthM: number,
): DamFrame {
  const chainages = segmentChainages(crestPath);
  const crestLengthM = chainages[chainages.length - 1];
  const halfCrop = Math.min(cropLengthM, crestLengthM) / 2;
  const waterKnown = outline.length >= 3;
  const waterCentroid = waterKnown ? outlineCentroid(outline) : [0, 0];

  // Crest chainage closest to the project reference point keeps the default crop
  // where the dam model has always been displayed.
  let datumChainage = 0;
  let datumDistance = Infinity;
  crestPath.forEach(([x, z], index) => {
    const distance = Math.hypot(x, z);
    if (distance < datumDistance) {
      datumDistance = distance;
      datumChainage = chainages[index];
    }
  });

  const candidateStepM = 25;
  const wallSamples = 13;
  let best: DamFrame | null = null;
  let bestChainageDrift = Infinity;

  for (let chainage = halfCrop; chainage <= crestLengthM - halfCrop; chainage += candidateStepM) {
    const start = pointAtChainage(crestPath, chainages, chainage - halfCrop);
    const end = pointAtChainage(crestPath, chainages, chainage + halfCrop);
    let dx = end[0] - start[0];
    let dz = end[1] - start[1];
    const span = Math.hypot(dx, dz);
    if (span < 1e-6) continue;
    dx /= span;
    dz /= span;

    const chordCentre: LocalPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    // Local +Z in scene coordinates, i.e. the downstream normal.
    let normal: LocalPoint = [-dz, dx];
    if (waterKnown) {
      const toWater = waterCentroid[0] - chordCentre[0];
      const toWaterZ = waterCentroid[1] - chordCentre[1];
      if (toWater * normal[0] + toWaterZ * normal[1] > 0) {
        // The measured water body must stay upstream. Reverse the axis if not.
        dx = -dx;
        dz = -dz;
        normal = [-dz, dx];
      }
    }

    // Perpendicular residuals of the crest against the chord, then shift the line
    // to split the residual (Chebyshev fit) instead of leaving it one-sided.
    let minResidual = Infinity;
    let maxResidual = -Infinity;
    const sampleCount = 24;
    for (let i = 0; i <= sampleCount; i++) {
      const [px, pz] = pointAtChainage(crestPath, chainages, chainage - halfCrop + (i / sampleCount) * halfCrop * 2);
      const residual = (px - chordCentre[0]) * normal[0] + (pz - chordCentre[1]) * normal[1];
      if (residual < minResidual) minResidual = residual;
      if (residual > maxResidual) maxResidual = residual;
    }
    if (!Number.isFinite(minResidual)) continue;

    const shift = -(minResidual + maxResidual) / 2;
    const crestFitErrorM = (maxResidual - minResidual) / 2;
    if (crestFitErrorM > CREST_ALIGNMENT_TOLERANCE_M) continue;

    const centre: LocalPoint = [
      chordCentre[0] + normal[0] * shift,
      chordCentre[1] + normal[1] * shift,
    ];

    let maxWaterGapM = 0;
    if (waterKnown) {
      const upstream: LocalPoint = [-normal[0], -normal[1]];
      for (let i = 0; i < wallSamples; i++) {
        const offset = -halfCrop + (i / (wallSamples - 1)) * halfCrop * 2;
        const gap = shorelineDistanceAlong(
          [centre[0] + dx * offset, centre[1] + dz * offset],
          upstream,
          outline,
          600,
        );
        if (gap > maxWaterGapM) maxWaterGapM = gap;
      }
    }

    const chainageDrift = Math.abs(chainage - datumChainage);
    const better =
      best === null
      || maxWaterGapM < best.maxWaterGapM - 1
      || (Math.abs(maxWaterGapM - best.maxWaterGapM) <= 1
        && (crestFitErrorM < best.crestFitErrorM - 1
          || (Math.abs(crestFitErrorM - best.crestFitErrorM) <= 1 && chainageDrift < bestChainageDrift)));

    if (better) {
      best = {
        // Local +X maps to (cos a, -sin a) under a Y rotation, so match the chord.
        angleRad: Math.atan2(-dz, dx),
        offsetX: centre[0],
        offsetZ: centre[1],
        chainageM: chainage,
        crestFitErrorM,
        maxWaterGapM: waterKnown ? maxWaterGapM : Number.NaN,
      };
      bestChainageDrift = chainageDrift;
    }
  }

  if (best) return best;

  // Every candidate exceeded the crest tolerance. Keep the dam on the surveyed
  // crest at the reference chainage and report the fit error rather than silently
  // falling back to an axis-aligned wall.
  const start = pointAtChainage(crestPath, chainages, datumChainage - halfCrop);
  const end = pointAtChainage(crestPath, chainages, datumChainage + halfCrop);
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const span = Math.hypot(dx, dz) || 1;
  const centre: LocalPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const unit: LocalPoint = [dx / span, dz / span];
  const normal: LocalPoint = [-unit[1], unit[0]];
  const residuals = crestPath.map(
    ([px, pz]) => (px - centre[0]) * normal[0] + (pz - centre[1]) * normal[1],
  );
  return {
    angleRad: Math.atan2(-unit[1], unit[0]),
    offsetX: centre[0],
    offsetZ: centre[1],
    chainageM: datumChainage,
    crestFitErrorM: (Math.max(...residuals) - Math.min(...residuals)) / 2,
    maxWaterGapM: Number.NaN,
  };
}

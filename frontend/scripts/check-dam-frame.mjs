// Independent check of the dam placement frame solved in
// frontend/src/components/DigitalTwin3D/damFrame.ts.
//
// The geometry below is deliberately re-implemented from the published records
// rather than imported, so a mistake in damFrame.ts shows up as a disagreement
// here instead of cancelling out. Keep the two in sync when the algorithm changes.
//
// Run: node scripts/check-dam-frame.mjs   (from the frontend directory)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const project = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data/projects/machhu-ii.json'), 'utf8'),
);
const shoreline = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'data/candidates/machhu-ii/reservoir-shoreline.geojson'),
    'utf8',
  ),
);

const CROP_LENGTH_M = 600; // must match DISPLAYED_DAM_LENGTH_M
const TOLERANCE_M = project.provenance?.[project.provenance.length - 1]?.uncertainty
  ?.crest_alignment_m?.[1] ?? 40;

const perLon = 111320 * Math.cos((project.latitude * Math.PI) / 180);
const toLocal = ([lon, lat]) => [
  (lon - project.longitude) * perLon,
  (lat - project.latitude) * 111320,
];

const crest = project.crest_coordinates.map(toLocal);
const outline = shoreline.features[0].geometry.coordinates[0].map(toLocal);

const cross = (ax, az, bx, bz) => ax * bz - az * bx;
const chainages = [0];
for (let i = 1; i < crest.length; i += 1) {
  chainages.push(
    chainages[i - 1] + Math.hypot(crest[i][0] - crest[i - 1][0], crest[i][1] - crest[i - 1][1]),
  );
}
const crestLength = chainages[chainages.length - 1];

function pointAt(chainage) {
  const s = Math.min(Math.max(chainage, 0), crestLength);
  for (let i = 1; i < chainages.length; i += 1) {
    if (s <= chainages[i]) {
      const span = chainages[i] - chainages[i - 1];
      const t = span > 0 ? (s - chainages[i - 1]) / span : 0;
      return [
        crest[i - 1][0] + (crest[i][0] - crest[i - 1][0]) * t,
        crest[i - 1][1] + (crest[i][1] - crest[i - 1][1]) * t,
      ];
    }
  }
  return crest[crest.length - 1];
}

// Distance from `origin` along `direction` to the first shoreline edge.
function waterDistance(origin, direction, cap = 600) {
  let nearest = cap;
  for (let i = 0; i < outline.length; i += 1) {
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

const centroid = outline.reduce(([x, z], [px, pz]) => [x + px, z + pz], [0, 0]);
centroid[0] /= outline.length;
centroid[1] /= outline.length;

const half = CROP_LENGTH_M / 2;
const samples = 13;
let best = null;

for (let chainage = half; chainage <= crestLength - half; chainage += 25) {
  const start = pointAt(chainage - half);
  const end = pointAt(chainage + half);
  let dx = end[0] - start[0];
  let dz = end[1] - start[1];
  const span = Math.hypot(dx, dz);
  if (span < 1e-6) continue;
  dx /= span;
  dz /= span;

  const chord = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  let normal = [-dz, dx];
  if ((centroid[0] - chord[0]) * normal[0] + (centroid[1] - chord[1]) * normal[1] > 0) {
    dx = -dx;
    dz = -dz;
    normal = [-dz, dx];
  }

  let minResidual = Infinity;
  let maxResidual = -Infinity;
  for (let i = 0; i <= 24; i += 1) {
    const [px, pz] = pointAt(chainage - half + (i / 24) * CROP_LENGTH_M);
    const residual = (px - chord[0]) * normal[0] + (pz - chord[1]) * normal[1];
    if (residual < minResidual) minResidual = residual;
    if (residual > maxResidual) maxResidual = residual;
  }

  const shift = -(minResidual + maxResidual) / 2;
  const fitError = (maxResidual - minResidual) / 2;
  if (fitError > TOLERANCE_M) continue;

  const centre = [chord[0] + normal[0] * shift, chord[1] + normal[1] * shift];
  const upstream = [-normal[0], -normal[1]];
  let maxGap = 0;
  for (let i = 0; i < samples; i += 1) {
    const offset = -half + (i / (samples - 1)) * CROP_LENGTH_M;
    const gap = waterDistance([centre[0] + dx * offset, centre[1] + dz * offset], upstream);
    if (gap > maxGap) maxGap = gap;
  }

  if (!best || maxGap < best.maxGap - 1
    || (Math.abs(maxGap - best.maxGap) <= 1 && fitError < best.fitError - 1)) {
    best = { chainage, dx, dz, centre, fitError, maxGap };
  }
}

if (!best) {
  console.error(`FAIL: no crop fits the crest within ${TOLERANCE_M} m`);
  process.exit(1);
}

const angleRad = Math.atan2(-best.dz, best.dx);
console.log(`crest length          ${crestLength.toFixed(0)} m over ${crest.length} points`);
console.log(`tolerance (published) ${TOLERANCE_M} m`);
console.log(`chosen chainage       ${best.chainage.toFixed(0)} m`);
console.log(`angle                 ${angleRad.toFixed(5)} rad (${((angleRad * 180) / Math.PI).toFixed(1)} deg)`);
console.log(`offset                x ${best.centre[0].toFixed(1)} m, z ${best.centre[1].toFixed(1)} m`);
console.log(`crest fit error       ${best.fitError.toFixed(1)} m`);
console.log('');

// Per-sample comparison: the crest-aligned wall against the previous placement
// (dam axis on X at z = 0, reservoir upstream at -z).
console.log('  offset   old gap   new gap   crest offset');
let worstNew = 0;
let worstOld = 0;
for (let i = 0; i < samples; i += 1) {
  const offset = -half + (i / (samples - 1)) * CROP_LENGTH_M;
  const oldGap = waterDistance([offset, 0], [0, -1]);
  const newGap = waterDistance(
    [best.centre[0] + best.dx * offset, best.centre[1] + best.dz * offset],
    [-(-best.dz), -best.dx],
  );
  const crestPoint = pointAt(best.chainage + offset);
  const crestOffset = Math.hypot(
    crestPoint[0] - (best.centre[0] + best.dx * offset),
    crestPoint[1] - (best.centre[1] + best.dz * offset),
  );
  worstNew = Math.max(worstNew, newGap);
  worstOld = Math.max(worstOld, oldGap);
  console.log(
    `${offset.toFixed(0).padStart(8)} ${oldGap.toFixed(0).padStart(9)} ${newGap.toFixed(0).padStart(9)} ${crestOffset.toFixed(0).padStart(14)}`,
  );
}

console.log('');
console.log(`worst water gap behind wall: old ${worstOld.toFixed(0)} m -> new ${worstNew.toFixed(0)} m`);
let failed = false;
if (worstNew > worstOld) {
  console.error('FAIL: placement left water further from the wall than before');
  failed = true;
}
if (best.fitError > TOLERANCE_M) {
  console.error(`FAIL: crest fit error ${best.fitError.toFixed(1)} m exceeds ${TOLERANCE_M} m`);
  failed = true;
}
if (!Number.isFinite(angleRad)) {
  console.error('FAIL: frame angle is not finite');
  failed = true;
}
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);

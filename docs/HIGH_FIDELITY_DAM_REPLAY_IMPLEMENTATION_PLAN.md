# High-Fidelity Dam Replay Implementation Plan

Status: implementation in progress; previous completion claim withdrawn. Visual, integrated authored-asset replay, and performance acceptance remain open.  
Target stack: existing FastAPI simulation service and a substantially upgraded Three.js renderer  
Primary goal: a credible, 1:1-scale engineering visualization with the visual finish of a modern real-time 3D application, progressive dam failure, and uncertainty-aware forecasting.

## Implementation record

The repository contains portions of the evidence-aware software path described by
this plan: versioned structural/provenance contracts, a reusable parametric asset
manifest, explicit progressive failure states and event records, shared water-volume
accounting, deterministic replay manifests, scenario-local gate schedules, retained
forecast vintages, P10/P50/P90 physics ensembles, compatibility metadata for legacy
runs, and modular Three.js replay components. The renderer uses one stable breach
deformation mesh, separate engineering/overview/diagnostic policies, 1:1 scale,
quality tiers, reduced-motion handling, an uncertainty chart, accessible state labels,
and a persistent patterned forecast treatment.

The 2026-09-22 renderer pass replaces the former flat strip and rectangular close-up
water plane with a stable multi-surface earthfill assembly, crest surface, toe
treatment, masked stage-responsive reservoir geometry, deterministic procedural PBR
materials, atmospheric lighting, and discharge-scaled flow sheets. It also adds
crest-path dimension checks, structural-availability status in the viewport, and a
synchronized saved-frame chart for reservoir level, breach width, and total release.
Desktop and 390 px browser captures were reviewed; this is software/render validation,
not approval against an external visual reference or an engineering sign-off.

The implementation deliberately does not create Machhu-II gates, spillway details,
material zoning, bathymetry, or mechanical ratings that are absent from approved
evidence. Those components are returned as `unavailable`; the visible embankment is
labelled `reconstructed archetype`. Authored compressed GLB/KTX2 assets can be added
through the asset manifest when approved source geometry exists, while the current
fallback remains parametric.

Additional code and validation remain necessary for portable-package integration with
saved runs, authored material/LOD review, and reference-image visual acceptance.
External inputs also remain necessary: survey-grade drawings/bathymetry,
approved gate and material data, observed 1979
validation fields, selected reference hardware/browser targets, approved visual
reference shots, a measured GPU performance session, and review by qualified
hydraulic/geotechnical engineers. No operational or validation claim is made in their
absence. Ensemble far-field depth, velocity, and arrival bands are available through
the opt-in `include_far_field` forecast request; when omitted to control compute cost,
their state is explicitly reported as unavailable.

## 1. Outcome

Replace the current procedural embankment strip and simple water primitives with a complete dam scene that communicates how the structure, reservoir, gates, spillway, breach, and downstream release evolve through time.

The finished replay must:

- show a recognizable dam system rather than a single extruded wall;
- preserve real-world dimensions and elevations at 1:1 scale;
- represent gates, piers, spillway bays, abutments, crest road, downstream slope, drainage/toe works, stilling basin, and reservoir contact where supported by evidence;
- begin with an intact or explicitly seeded defect and grow the breach continuously over simulated time;
- couple breach growth to reservoir head, velocity, shear stress, erodibility, slope stability, and mass conservation;
- show observed/simulated history separately from forecast states and uncertainty;
- retain the regional flood map as a separate operational overview, not as the close-up model;
- clearly label surveyed, sourced, reconstructed, assumed, and unavailable properties.

“Unity/Unreal quality” is treated as a quality target for composition, materials, lighting, effects, animation continuity, and performance. The application remains browser-delivered Three.js unless a later architectural decision explicitly changes that constraint.

## 2. Non-negotiable scientific rules

1. Never invent a site-specific gate count, spillway shape, dam section, material layer, elevation, or mechanical behavior and present it as fact.
2. Every physical dimension must come from an approved source, a project configuration field, or an explicitly labelled reconstruction rule.
3. Work in metres, seconds, cubic metres, Pascals, and the project CRS internally. Rendering may use a local origin but must retain reversible world coordinates.
4. Maintain 1:1 vertical scale in engineering mode. Any exaggerated diagnostic view must be a separate labelled mode.
5. The reservoir, gate releases, overtopping, breach discharge, and downstream routing must share one volume ledger.
6. The visual breach is a rendering of solver state. It must not independently invent failure timing or geometry.
7. Forecasts must expose model version, initialization time, horizon, ensemble assumptions, and confidence bands. They must not be presented as observations.
8. Preserve deterministic replay: the same saved run and renderer version must produce the same geometry state at the same timestamp.

## 3. Required evidence and reusable dam schema

Extend the generic project schema so a new dam can be configured without rewriting renderer code.

### 3.1 Site geometry

- dam type and structural zoning;
- crest polyline, crest elevation, width, and road profile;
- upstream/downstream slopes and berms;
- left/right abutment geometry;
- foundation/toe elevation profiles;
- reservoir shoreline or stage-dependent water polygon;
- spillway, intake, outlet, stilling basin, and downstream channel footprints;
- local high-resolution DEM or surveyed terrain where available.

### 3.2 Hydraulic structures

- spillway type and crest profile;
- bay count, bay spacing, pier dimensions, gate type, width, height, sill elevation, and operating range;
- gate opening time series and discharge coefficients;
- outlet/conduit geometry and ratings;
- energy dissipation structure dimensions;
- normal, warning, maximum, and crest water levels;
- stage-area-storage table.

### 3.3 Materials and failure parameters

- embankment/core/filter/shell material zones;
- density, cohesion, friction angle, porosity, saturation, critical shear, erodibility, and permeability ranges;
- riprap or armouring properties;
- credible parameter distributions, not only single defaults;
- known defects, piping indicators, overtopping initiation points, or scenario seed location.

### 3.4 Provenance contract

Each field should include `value`, `unit`, `source_id`, `status`, `uncertainty`, and `approved_by`. Allowed statuses should include `surveyed`, `official`, `derived`, `reconstructed`, `assumed`, and `unavailable`. The renderer must be able to show this status for selected components.

When exact geometry is unavailable, use a documented dam-type template driven by the known dimensions. Display “reconstructed archetype” in the viewport and provenance panel.

## 4. Scene and asset architecture

### 4.1 Separate scene layers

- **Engineering close-up:** high-detail dam, hydraulic structures, nearby terrain, water, breach, and flow effects; no satellite raster.
- **Operational overview:** DEM, imagery, flood depth/velocity/arrival layers, facilities, and regional context.
- **Diagnostic mode:** optional material zones, pressure, shear, saturation, factor of safety, mesh bounds, and solver cells.

Mode changes must not merely move the same camera. Each mode gets its own visibility policy, lighting, clipping distances, level of detail, and legend.

### 4.2 Dam asset pipeline

Build the model as a reusable parametric assembly:

1. Generate the embankment body from crest and toe profiles with continuous cross-sections.
2. Generate zoned internal volumes for core, filters, shells, drainage, and foundation when those data exist.
3. Place modular spillway bays, piers, gates, hoists, bridge/crest roadway, railings, service buildings, intake towers, conduits, and stilling basin from project data.
4. Conform abutments and toe geometry to the near-field terrain mesh.
5. Export authored reusable components as glTF/GLB with physically based materials.
6. Use Meshopt or Draco geometry compression and KTX2/Basis textures.
7. Provide high/medium/low LODs and simple collision/picking meshes.

Use shared material instances and instanced meshes for repeated piers, gates, rails, and lamps. Do not rebuild or dispose the entire dam mesh on each simulation frame.

### 4.3 Proper scale and camera language

- Keep all structures in metres and compare loaded bounds against configured dimensions.
- Include an optional human, vehicle, gate-height, or scale-bar reference without cluttering the operational view.
- Provide authored camera presets: upstream inspection, downstream inspection, spillway, breach, abutment, crest, and free orbit.
- Use smooth, interruptible camera transitions; never snap the camera during replay.
- Constrain near/far planes per mode to protect depth precision.
- Keep orbit targets attached to meaningful components and prevent the camera from entering geometry.

## 5. Rendering quality target

### 5.1 Materials

- PBR earth, compacted soil, grass, weathered concrete, wet concrete, steel, painted gates, riprap, road asphalt, and sediment materials;
- normal, roughness, ambient-occlusion, and detail maps with physically plausible scale;
- wetness masks driven by water contact and recent flow;
- subtle material variation to avoid flat procedural bands;
- triplanar or terrain-splat mapping to avoid stretched textures on steep slopes.

### 5.2 Lighting and image quality

- linear-sRGB workflow, sRGB display output, ACES filmic tone mapping, and calibrated exposure;
- HDR environment lighting plus a directional sun with cascaded or tuned shadow maps;
- soft contact shadows and ambient occlusion around piers, gates, and the dam toe;
- temporal or multisample antialiasing appropriate to the selected renderer path;
- optional restrained bloom only for emissive indicators, not the whole scene;
- fog/atmospheric perspective scaled to the engineering scene;
- day, overcast, and emergency-night presets if justified by the use case.

### 5.3 Water and hydraulic effects

The reservoir must not be a flat opaque rectangle.

- Use a continuous tessellated water surface clipped to the reservoir/terrain boundary.
- Animate multi-scale normal waves, Fresnel reflection, depth-dependent colour, shoreline foam, and contact darkening.
- Update water elevation from the reservoir state every frame.
- Represent spillway sheets, gate jets, nappe breakup, breach jets, turbulence, spray, foam, and sediment as separate effects tied to discharge and velocity.
- Use GPU particles or instanced sprites for spray and entrained sediment, with bounded particle budgets.
- Create downstream wetting and foam masks from simulated depth/velocity, not decorative random placement.
- Ensure effects degrade gracefully on lower-capability GPUs.

### 5.4 Performance budgets

Initial targets for a 1080p desktop view:

- 60 FPS preferred and 30 FPS minimum during replay on a representative mid-range discrete GPU;
- less than 16.7 ms preferred / 33 ms maximum sustained frame time;
- no per-frame topology rebuild of the complete dam;
- bounded draw calls through instancing, merged static geometry, and LOD;
- textures loaded progressively with a visible loading state;
- automatic quality tiers for shadows, reflections, particles, water tessellation, and post-processing;
- reduced-motion mode that preserves state meaning without aggressive camera/effect motion.

Record the test machine and measured budgets; do not claim these targets without profiling.

## 6. Progressive breach physics

### 6.1 Failure states

Represent breach evolution as a state machine driven by solver conditions:

1. `intact` — no visible opening;
2. `incipient` — local overtopping erosion, piping outlet, crack, or user-defined seed;
3. `erosion` — bed/invert lowers and the opening widens according to excess shear and erodibility;
4. `mass_failure` — side blocks fail when slope stability or collapse criteria are exceeded;
5. `widening` — continuing hydraulic erosion and intermittent side-slope collapse;
6. `stabilizing` — growth slows as reservoir head and shear decline or resistant layers are reached;
7. `final` — breach geometry and hydrograph approach the end state.

Transitions and thresholds must be saved in each run. “Instantaneous breach” may remain only as an explicitly selected comparison model.

### 6.2 Coupled equations and constraints

At each physics step:

1. Compute reservoir stage from storage and the stage-storage curve.
2. Compute hydrostatic pressure and hydraulic head at the breach seed/opening.
3. Compute gate, outlet, spillway, overtopping, and breach discharge using the appropriate rating/weir/orifice relations.
4. Compute local velocity, boundary shear, and sediment transport/erosion potential.
5. Lower the breach invert using the selected erosion relation only when critical shear is exceeded.
6. Widen the breach using bank erosion and discrete side-slope collapse criteria.
7. Limit geometry changes by material availability, resistant layers, maximum credible slopes, and stable numerical rates.
8. Update removed material volume and sediment diagnostics.
9. Route released water downstream.
10. Close the shared reservoir mass balance and record residuals.

Minimum model options:

- excess-shear erosion for overtopping scenarios;
- piping initiation and enlargement for internal erosion scenarios;
- parameterized historical/empirical model for comparison;
- manually prescribed geometry only for controlled validation tests.

### 6.3 Continuous geometry animation

Do not remove rectangular dam segments frame by frame.

- Maintain a stable dam mesh topology with a high-resolution breach deformation zone.
- Drive invert elevation, bottom width, top width, side slopes, and bank retreat from solver keyframes.
- Interpolate saved solver frames with monotonic cubic or physically bounded interpolation.
- Use mesh morphing, vertex deformation, or local remeshing only inside the breach zone.
- Animate intermittent bank collapses as short events triggered by solver failure records; update the persistent geometry after each event.
- Add debris/sediment effects as visualization of recorded erosion volume, not as an independent source of removed mass.
- Support slow motion, pause, frame stepping, and exact timestamp seeking without changing results.

## 7. Gates, spillway, and reservoir interaction

- Animate each gate from its opening time series, including opening limits and rates.
- Derive each bay’s discharge from upstream/downstream head, gate opening, width, coefficient, and submergence state.
- Show closed, partially open, fully open, unavailable, and unknown states distinctly.
- Route gate and spillway discharge into the stilling basin/channel with corresponding jets and energy dissipation.
- Apply reservoir drawdown to shoreline/water elevation and update exposed wet terrain.
- Support operator-defined gate schedules and forecast alternatives without modifying the base project data.
- Include gate-discharge and reservoir-level plots synchronized with the 3D timeline.

## 8. Time series and forecasting

### 8.1 Timeline model

Store simulation output as immutable, versioned runs containing:

- physics timestamps and optional higher-rate visual interpolation timestamps;
- reservoir level, storage, inflow, rainfall/runoff, gate states, and all release components;
- breach state, invert, top/bottom width, side slopes, eroded volume, shear, pressure, and failure events;
- discharge hydrographs and downstream depth/velocity/arrival fields;
- mass ledger and numerical diagnostics;
- source/configuration hashes and renderer-compatible schema version.

### 8.2 Forecast engine

Forecasting should be model-based and uncertainty-aware:

1. Initialize from the latest observed or scenario state.
2. Generate an ensemble across inflow/rainfall forecasts, gate schedules, breach seed conditions, and material parameter distributions.
3. Run bounded parallel simulations for a configured horizon.
4. Produce median and percentile bands for reservoir level, breach dimensions, peak discharge, arrival time, depth, and velocity.
5. Persist every ensemble member’s inputs or reproducible random seed.
6. Reforecast when new observations arrive while retaining prior forecast vintages for comparison.

Do not use an opaque ML prediction as the primary forecast. A surrogate model may later accelerate the physics ensemble only after validation against the full solver and with an out-of-distribution guard.

### 8.3 Forecast UX

- Divide the timeline into `history`, `current state`, and `forecast` regions.
- Use a clear “forecast begins” marker and initialization timestamp.
- Show P10/P50/P90 or approved uncertainty bands in synchronized charts.
- Let users select an ensemble member, median, or credible worst case.
- Label forecast geometry with a persistent visual treatment that does not rely on colour alone, such as a border/pattern plus text.
- Display stale-input and unavailable-observation warnings prominently.
- Never animate uncertainty as if all alternatives happen simultaneously; show one selected trajectory plus its range.

## 9. Backend and frontend architecture

### 9.1 Backend

- Add versioned models for structural geometry, gate schedules, material zones, breach states, failure events, forecast ensembles, and provenance.
- Separate the physics timestep from output sampling and visual interpolation.
- Stream lightweight replay state over WebSocket; serve heavy terrain, meshes, and field textures as cached assets.
- Add endpoints for run metadata, exact frame/keyframe access, forecast summaries, ensemble selection, and asset manifests.
- Preserve old saved runs through a migration/compatibility adapter or mark them explicitly as legacy.
- Keep solver calculations server-side; the browser interpolates and renders but does not author scientific state.

### 9.2 Frontend modules

- `SceneDirector`: mode-specific visibility, lighting, camera, and quality settings;
- `DamAssetLoader`: validated glTF and parametric fallback assembly;
- `ReplayClock`: deterministic playback, seeking, interpolation, and speed control;
- `DamDeformer`: local progressive breach geometry;
- `HydraulicEffects`: reservoir, gates, spillway, breach flow, foam, spray, and sediment;
- `ForecastLayer`: trajectory selection and uncertainty display;
- `TelemetryPanel`: synchronized plots, event markers, units, and provenance;
- `QualityManager`: GPU capability detection, LOD, resolution scale, and effect budgets;
- `Diagnostics`: coordinates, bounds, mass ledger, frame timing, draw calls, and source status.

Keep these modules small and data-driven. Avoid a parallel renderer-specific physics implementation.

## 10. Delivery phases

### Phase 0 — Baseline and specifications

- Freeze representative saved runs and screenshots for regression.
- Define target desktop hardware and browser matrix.
- Finalize the structural/replay/forecast schemas and provenance rules.
- Create dimensioned reference sheets for Machhu-II from approved evidence.
- Document which components are exact, reconstructed, or unavailable.

Exit criterion: signed-off scene specification and data-gap register.

### Phase 1 — Parametric dam and hydraulic structures

- Implement continuous embankment and abutment generation.
- Build modular gates, piers, spillway, crest road, outlet, and stilling basin assets.
- Add scale validation and component inspection/provenance.
- Produce LODs and compressed assets.

Exit criterion: intact dam scene matches approved dimensions and remains reusable for another configured dam.

### Phase 2 — Progressive breach solver

- Implement explicit failure states and event records.
- Couple pressure, shear, erosion, collapse, reservoir drawdown, and releases.
- Add piping and overtopping initiation modes.
- Add mass/material-volume diagnostics and numerical guards.

Exit criterion: benchmark cases show gradual, reproducible breach development and close the water balance within the approved tolerance.

### Phase 3 — Continuous breach rendering

- Replace segment deletion with local mesh deformation/remeshing.
- Interpolate geometry and hydraulic state between solver keyframes.
- Add bank-collapse events, sediment, and flow effects tied to solver output.
- Verify seeking and replay determinism.

Exit criterion: no instantaneous visual jump unless the underlying selected model explicitly contains one.

### Phase 4 — High-fidelity rendering

- Complete PBR material library, HDR lighting, shadows, AO, water, reflections, wetness, foam, spray, and quality tiers.
- Add authored cameras and a loading/streaming experience.
- Profile and optimize GPU/CPU/memory use.

Exit criterion: approved visual-reference shots and sustained target frame rate on the reference hardware.

### Phase 5 — Forecast ensembles and UX

- Implement ensemble orchestration, uncertainty summaries, and forecast vintages.
- Add history/current/forecast timeline, synchronized charts, and trajectory selection.
- Add stale/unavailable data states and provenance inspection.

Exit criterion: a user can distinguish observation, simulation, and forecast at all times and reproduce any displayed trajectory.

### Phase 6 — Validation and operational hardening

- Compare hydrographs and breach evolution against published benchmark cases and any available event/site data.
- Run sensitivity, conservation, stability, and extreme-input tests.
- Run visual regression, accessibility, browser, GPU fallback, and long-session tests.
- Review all labels and claims with a qualified hydraulic/geotechnical engineer before operational use.

Exit criterion: all definition-of-done checks below pass and limitations are documented.

## 11. Test plan

### 11.1 Physics tests

- no erosion below the configured threshold;
- monotonic breach growth unless a documented stabilization mechanism applies;
- gradual onset from a small seed for progressive models;
- bounded invert lowering, widening, and bank retreat per timestep;
- gate/orifice/weir rating checks against analytical cases;
- stage-storage interpolation and reservoir drawdown checks;
- water mass residual within an approved tolerance;
- eroded geometry volume consistent with recorded removed material;
- deterministic rerun from the same inputs and seeds;
- stable behavior at dry, overtopped, submerged, zero-head, and extreme-head limits.

### 11.2 Forecast tests

- ensemble inputs and seeds are reproducible;
- percentile ordering never crosses;
- forecast initialization equals the selected current state;
- reforecasting preserves old vintages;
- missing observations and stale inputs are visible;
- surrogate output, if introduced, is rejected outside its validated domain.

### 11.3 Visual and interaction tests

- dimension/bounds tests for every generated component;
- golden screenshots for intact, initiation, erosion, collapse, widening, and stabilized states;
- timeline seek, reverse seek, pause, step, slow motion, and speed changes;
- no satellite imagery in engineering mode;
- no geometry popping at LOD transitions near the inspection cameras;
- keyboard-accessible controls, visible focus, readable contrast, and reduced motion;
- responsive layouts without obscuring critical warnings or timestamps;
- explicit legends, units, time basis, data status, and provenance.

### 11.4 Performance tests

- frame-time percentiles, GPU memory, JavaScript heap, draw calls, triangle count, and asset transfer size;
- 30-minute replay soak test without growing memory or duplicated scene objects;
- low/medium/high quality tiers on the agreed browser/hardware matrix;
- slow-network asset loading and failed-asset fallback behavior.

## 12. Definition of done

The work is complete only when all of the following are true:

- the close-up is a complete dam scene with gates and hydraulic structures appropriate to the approved data;
- geometry dimensions are automatically checked against project configuration;
- progressive breach runs begin from an intact/small-seed state and develop over time from solver forces;
- reservoir, gate, spillway, overtopping, breach, and downstream water volumes are coupled;
- visual deformation follows saved solver states without rectangular slice deletion;
- replay seeking is deterministic and forecasting is clearly separated from history;
- forecast uncertainty and assumptions are inspectable;
- source/assumption status is available for every significant structure and parameter;
- target visual references are approved and performance budgets are measured on reference hardware;
- automated physics, API, replay, visual, accessibility, and performance checks pass;
- limitations and the non-operational/screening status remain visible unless engineering validation justifies a different classification.

## 13. Decisions required before implementation

1. Confirm that browser-based Three.js remains mandatory, or authorize a separate Unity/Unreal build. This plan assumes Three.js.
2. Select reference desktop hardware, browsers, minimum frame rate, and maximum initial download size.
3. Approve the exact visual references and quality bar for concrete, terrain, water, spray, and lighting.
4. Approve the Machhu-II structural reconstruction and identify which gate/spillway dimensions are authoritative.
5. Select the validated progressive breach formulations and acceptable numerical/conservation tolerances with an engineering reviewer.
6. Define available live observations and external rainfall/inflow forecast sources.
7. Define forecast horizon, ensemble size, latency target, and acceptable compute budget.
8. Decide whether Blender-authored reusable assets are allowed in addition to procedural geometry.

## 14. Recommended first implementation slice

Do not start with post-processing or particles. Build one end-to-end, evidence-backed vertical slice:

1. one correctly scaled dam section with one spillway/gate assembly;
2. continuous reservoir drawdown and one gate schedule;
3. a small overtopping seed that grows through five or more saved solver stages;
4. continuous local mesh deformation and a discharge-driven flow sheet;
5. synchronized reservoir, breach-width, and discharge charts;
6. provenance labels and mass-balance diagnostics;
7. a measured visual/performance capture on reference hardware.

Only after this slice passes engineering and visual review should the work expand to the full dam, richer effects, piping scenarios, and forecast ensembles.

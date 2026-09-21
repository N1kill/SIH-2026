/**
 * PRALAYA — Benchmark Historical Dam Breaches & High-Impact Flood Disasters
 * 
 * Curated case studies documenting catastrophic dam-break events
 * and high-impact regional flood disasters for empirical hydraulic comparison.
 */

export const HISTORICAL_CASES = [
  // ==========================================
  // SECTION 1: CATASTROPHIC DAM BREACHES
  // ==========================================
  {
    id: 'teesta-iii',
    name: 'Teesta III Dam',
    subtitle: 'Chungthang, Sikkim',
    category: 'dam-breach',
    categoryLabel: 'DAM BREACH DISASTER',
    tag: 'Major Impact',
    variant: 'clay',
    date: '4 October 2023',
    location: 'Chungthang, Mangan District, Sikkim',
    coordinates: '27.603°N, 88.646°E',
    river: 'Teesta River',
    damType: 'Concrete Gravity Dam (CFRD / 60 m height)',
    image: '/images/cases/teesta.jpg',
    stats: [
      { label: 'CASUALTIES', value: '47 – 90+', alert: true },
      { label: 'POWER CAPACITY', value: '1,200 MW', sub: 'Completely destroyed' },
      { label: 'TRIGGER EVENT', value: 'South Lhonak GLOF', sub: 'Glacial outburst flood' },
      { label: 'INFRA LOSS', value: '₹14,000+ Cr', sub: '14+ bridges washed away' },
    ],
    whatHappened:
      'In the early hours of 4 October 2023, a massive rock-ice avalanche plunged into the high-altitude South Lhonak glacial lake, displacing water and overtopping its natural moraine dam. The catastrophic glacial lake outburst flood (GLOF) surged down the Lachen valley with immense kinetic energy and sediment load, completely overtopping and washing away the 1,200 MW Teesta III hydropower dam at Chungthang within minutes.',
    humanImpact:
      'At least 47 deaths were confirmed in initial reports, with final counts and missing persons exceeding 90 fatalities, including 23 Indian Army personnel swept away at Bardang. Thousands were displaced across Chungthang, Dikchu, Singtam, and Rangpo.',
    infraImpact:
      'The 1,200 MW Teesta Stage-III hydropower station was completely obliterated, submerging the subterranean powerhouse. National Highway 10 was severed in multiple sections, and more than 14 major bridges connecting North Sikkim were destroyed.',
    cause:
      'Cascading Cryosphere Hazard: Glacial Lake Outburst Flood (GLOF) triggered by moraine failure at South Lhonak Lake, amplified by intense antecedent monsoon precipitation and high alluvial sediment concentration.',
    researchFocus:
      'Early warning telemetry for high-altitude glacial lakes, hydrodynamic surge routing under ultra-high bedload conditions, and failure resilience criteria for run-of-river concrete structures during non-standard flood surges.',
    references: [
      { title: 'AP Disaster Report: Glacial lake burst destroys Sikkim dam', source: 'Associated Press (AP News)' },
      { title: 'Dam Safety Concerns & Hazard Assessments in Eastern Himalayas', source: 'CWC & NDMA Technical Review' },
    ],
  },

  {
    id: 'tiware-dam',
    name: 'Tiware Dam',
    subtitle: 'Ratnagiri, Maharashtra',
    category: 'dam-breach',
    categoryLabel: 'DAM BREACH DISASTER',
    tag: 'Rainfall-Related',
    variant: 'amber',
    date: '2 July 2019',
    location: 'Chiplun, Ratnagiri District, Maharashtra',
    coordinates: '17.585°N, 73.551°E',
    river: 'Vashishti River tributary',
    damType: 'Earthen Embankment Dam (14 m height, 2.4 MCM)',
    image: '/images/cases/tiware.jpg',
    stats: [
      { label: 'CASUALTIES', value: '23 Fatalities', sub: '19 bodies + 4 missing', alert: true },
      { label: 'AFFECTED VILLAGES', value: '7 Hamlets', sub: 'Bhendewadi washed out' },
      { label: 'TRIGGER EVENT', value: '>300 mm Rain', sub: 'Heavy 24h deluge' },
      { label: 'FAILURE MODE', value: 'Piping & Breach', sub: 'Structural fissure failure' },
    ],
    whatHappened:
      'Following extreme monsoon rainfall of over 300 mm in 24 hours in the Western Ghats catchment, the reservoir filled rapidly. A major fissure developed along the downstream embankment slope, and within hours, progressive piping erosion caused the earthen dam to rupture completely, unleashing 2.4 million cubic meters of water on downstream settlements.',
    humanImpact:
      'At least 19 deaths were confirmed and four remained permanently missing. The tiny hamlet of Bhendewadi directly downstream of the dam axis was entirely washed away, with 12 residential dwellings submerged or obliterated within 15 minutes of the breach.',
    infraImpact:
      'Complete loss of the earthen storage structure, destruction of connecting culverts, rural approach roads, electric transmission poles, and extensive scouring of downstream terraced agricultural farmland across seven villages.',
    cause:
      'Severe monsoon overtopping compounded by pre-existing embankment seepage and internal piping. Local residents had previously flagged visible cracks and water leaks, which led to a subsequent Special Investigation Team (SIT) inquiry.',
    researchFocus:
      'Embankment compaction quality, regular statutory pre-monsoon dam inspections, automated piezometric seepage sensing, and localized last-mile sirens for high-risk rural earthen structures.',
    references: [
      { title: 'Tiware Dam Breach Inquiry Committee Report', source: 'Maharashtra Water Resources Department (SIT)' },
      { title: 'Dam Safety Audits & Embankment Erosion Case Review', source: 'ASDSO / Indian Geotechnical Journal' },
    ],
  },

  {
    id: 'karam-dam',
    name: 'Karam Dam',
    subtitle: 'Dhar, Madhya Pradesh',
    category: 'dam-breach',
    categoryLabel: 'DAM BREACH DISASTER',
    tag: 'Construction Investigation',
    variant: 'moss',
    date: '12 – 14 August 2022',
    location: 'Gujri / Dharampuri, Dhar District, Madhya Pradesh',
    coordinates: '22.336°N, 75.398°E',
    river: 'Karam River (Narmada Basin)',
    damType: 'Under-Construction Earthen Dam (590 m length)',
    image: '/images/cases/karam.jpg',
    stats: [
      { label: 'CASUALTIES', value: '0 Fatalities', sub: 'Pre-emptive evacuation' },
      { label: 'EVACUATED POPULATION', value: '10,000+ People', sub: '18 villages relocated' },
      { label: 'RESERVOIR VOLUME', value: '15 MCM Water', sub: 'Drained safely via bypass' },
      { label: 'EMERGENCY ACTION', value: 'Controlled Cut', sub: 'Excavated side bypass channel' },
    ],
    whatHappened:
      'During initial monsoon impoundment of the newly constructed ₹304-crore Karam Dam, alarming lateral fissures and significant soil slippage were detected on the downstream right earthen flank. As water began seeping heavily through the foundation interface, national agencies mobilized heavy earthmoving machinery to excavate a 4-meter-wide bypass relief channel through bedrock to safely drain 15 million cubic meters of water before catastrophic uncontrolled collapse.',
    humanImpact:
      'Zero loss of life was achieved thanks to swift coordinated action: over 10,000 residents across 18 downstream villages in Dhar and Khargone districts were evacuated to relief shelters within 36 hours before peak discharge.',
    infraImpact:
      'Severe structural destabilization of the newly built earthen embankment requiring demolition and reconstruction of major sections. National Highway 3 (Agra-Mumbai) was shut down for two days during the emergency bypass release.',
    cause:
      'Construction quality and engineering compaction were subjected to an official high-level inquiry. The investigation focused on embankment core materials, compaction density, and foundation waterproofing during the first impoundment phase.',
    researchFocus:
      'First-filling hazard protocols, construction-stage risk assessment, rapid mechanical bypass excavation during imminent failure, and multi-agency evacuation coordination.',
    references: [
      { title: 'Karam Dam Seepage Investigation & Emergency Drainage Strategy', source: 'Madhya Pradesh State Dam Safety Authority' },
      { title: 'Controlled Release and Disaster Aversion during Dam Distress', source: 'Central Water Commission (CWC)' },
    ],
  },

  {
    id: 'machhu-ii',
    name: 'Machhu-II Dam',
    subtitle: 'Morbi, Gujarat (1979 Benchmark)',
    category: 'dam-breach',
    categoryLabel: 'DAM BREACH DISASTER',
    tag: 'Catastrophic Benchmark',
    variant: 'clay',
    date: '11 August 1979',
    location: 'Morbi, Saurashtra, Gujarat',
    coordinates: '22.820°N, 70.840°E',
    river: 'Machhu River',
    damType: 'Composite Dam (Masonry spillway + Earthen flanks)',
    image: '/images/cases/machhu.jpg',
    stats: [
      { label: 'CASUALTIES', value: '1,800 to >25,000', sub: 'Worst in modern Indian history', alert: true },
      { label: 'PEAK INFLOW', value: '13,570 m³/s', sub: '218% of spillway capacity' },
      { label: 'FLOOD WAVE HEIGHT', value: '8 – 10 Meters', sub: 'Arrived at Morbi in 20 min' },
      { label: 'BREACH WIDTH', value: '400+ Meters', sub: 'Both earthen flanks destroyed' },
    ],
    whatHappened:
      'A continuous 460 mm torrential rainfall deluge in 24 hours generated a massive reservoir inflow of 13,570 m³/s — more than double the designed spillway discharge capacity of 6,230 m³/s. Water overtopped the earthen embankments by 0.5 meters, scouring the downstream slopes and triggering progressive catastrophic collapse of both earthen flanks while the central masonry spillway remained standing.',
    humanImpact:
      'An estimated 1,800 to over 25,000 citizens perished when an 8-to-10 meter hydrodynamic wave inundated the industrial city of Morbi just 9 km downstream in under 20 minutes, giving residents virtually no time to evacuate.',
    infraImpact:
      'Morbi was submerged under mud and water up to rooftop levels. Over 68 factories, dozens of historical bridges, public buildings, and agricultural fields across the Saurashtra region were completely leveled.',
    cause:
      'Spillway capacity vastly exceeded (218% of design flood). The earthen embankments were not designed to withstand overtopping flow, leading to rapid hydraulic head erosion and breach widening to over 400 meters.',
    researchFocus:
      'SCS-CN unit hydrograph calibration, Froehlich / Von Thun breach widening kinetics, 2D Saint-Venant hydrodynamic wave propagation, and evacuation arrival timeline computation (PRALAYA core benchmark).',
    references: [
      { title: 'Machhu-II Dam Failure Case Study', source: 'Association of State Dam Safety Officials (ASDSO)' },
      { title: 'The Morbi Dam Disaster: Hydrological Analysis & Lessons', source: 'Indian Water Resources Society (IWRS)' },
    ],
  },

  // ==========================================
  // SECTION 2: HIGH-IMPACT FLOOD DISASTERS
  // ==========================================
  {
    id: 'chamoli-disaster',
    name: 'Chamoli Disaster',
    subtitle: 'Uttarakhand (2021)',
    category: 'flood-event',
    categoryLabel: 'HIGH-IMPACT FLOOD EVENT',
    tag: 'Flash Flood / Debris Surge',
    variant: 'amber',
    date: '7 February 2021',
    location: 'Rishi Ganga & Dhauliganga Valleys, Chamoli, Uttarakhand',
    coordinates: '30.485°N, 79.715°E',
    river: 'Rishi Ganga / Dhauliganga (Alaknanda Basin)',
    damType: 'Debris Flow impacting Run-of-River Barrages',
    image: '/images/cases/chamoli.jpg',
    stats: [
      { label: 'CASUALTIES', value: '204+ Missing/Dead', sub: 'Tunnel & site workers', alert: true },
      { label: 'DEBRIS VOLUME', value: '27 Million m³', sub: 'Rock-ice mass detached' },
      { label: 'PEAK VELOCITY', value: '~15 – 25 m/s', sub: 'Hyper-concentrated slurry' },
      { label: 'INFRA DAMAGED', value: '2 Hydropower Projects', sub: 'Rishiganga & Tapovan' },
    ],
    whatHappened:
      'A colossal wedge of rock and hanging glacier detached from the north face of Ronti peak (~5,600 m), plunging 1,800 m into the valley. The friction melted ice into a hyper-turbulent slurry of water, pulverized rock, and boulders that roared down the Rishi Ganga and Dhauliganga rivers, annihilating the 13.2 MW Rishiganga small hydro project and severely breaching the intake barrage of the NTPC 520 MW Tapovan Vishnugad project.',
    humanImpact:
      'Over 204 people were killed or reported missing, the majority being workers trapped inside the Tapovan headrace and intake tunnels when the silt-debris surge submerged tunnel mouths under meters of mud.',
    infraImpact:
      'The Rishiganga project was completely erased. The under-construction Tapovan Vishnugad barrage was heavily broken and filled with silt. Five motorable bridges connecting border outposts were washed out.',
    cause:
      'Non-reservoir failure: Cryospheric slope detachment and hyper-concentrated debris flow. Note: This was NOT a conventional reservoir dam break, but a severe cascade hazard destroying downstream hydraulic infrastructure.',
    researchFocus:
      'Satellite SAR slope-instability monitoring in peri-glacial zones, acoustic sensing in mountain tunnels, and run-of-river sediment defense design for Himalayan hydropower projects.',
    references: [
      { title: 'A massive rock and ice avalanche in the Chamoli Himalayas', source: 'Science Journal (June 2021)' },
      { title: 'Tapovan Vishnugad Infrastructure Forensic Assessment', source: 'Geological Survey of India (GSI)' },
    ],
  },

  {
    id: 'kerala-floods-2018',
    name: 'Kerala Multi-Basin Deluge',
    subtitle: 'Western Ghats / All Kerala (2018)',
    category: 'flood-event',
    categoryLabel: 'HIGH-IMPACT FLOOD EVENT',
    tag: 'Extreme Rainfall & Reservoir Operations',
    variant: 'moss',
    date: 'August 2018',
    location: 'Periyar, Pamba, Chalakudy Basins, Kerala',
    coordinates: '9.850°N, 76.970°E',
    river: 'Periyar, Pamba, Bharathappuzha & 41 rivers',
    damType: 'Multi-Reservoir Simultaneous Spillway Surcharge',
    image: '/images/cases/kerala.jpg',
    stats: [
      { label: 'CASUALTIES', value: '483 Fatalities', sub: '1.4M displaced to camps', alert: true },
      { label: 'DAMS OPENED', value: '35 of 54 Dams', sub: 'Simultaneous floodgate release' },
      { label: 'RECORD MONSOON', value: '2,346 mm Rain', sub: '42% above seasonal mean' },
      { label: 'ECONOMIC IMPACT', value: '₹40,000+ Cr', sub: 'Major transport & urban loss' },
    ],
    whatHappened:
      'Between 1 and 19 August 2018, Kerala experienced unprecedented continuous monsoon downpours exceeding 42% above normal. Major storage reservoirs — including Idukki (Cheruthoni gates opened for first time in 26 years), Idamalayar, and Kakki — reached Full Reservoir Level (FRL) simultaneously. To prevent catastrophic overtopping, 35 major dams opened their floodgates concurrently, swelling downstream river systems into historic regional inundation.',
    humanImpact:
      '483 deaths were recorded across the state, and over 1.45 million people were evacuated to relief camps. Entire urban corridors in Kochi, Aluva, Chalakudy, and Chengannur were submerged for days.',
    infraImpact:
      'Over 83,000 km of roads, Cochin International Airport (runways flooded for 2 weeks), electric substations, and tens of thousands of homes were heavily damaged, with recovery estimates exceeding ₹40,000 crore.',
    cause:
      'Extreme meteorologic precipitation event and catchment saturation. Crucial distinction: This was NOT a structural dam collapse; rather, reservoir flood surcharge management under unprecedented multi-basin precipitation.',
    researchFocus:
      'Dynamic rule-curve optimization, real-time Doppler radar catchment rainfall forecasting, coupled multi-reservoir cascade release routing, and coordinated emergency warnings.',
    references: [
      { title: 'Kerala Floods 2018: Hydrological Analysis of the Event', source: 'Central Water Commission (CWC Report)' },
      { title: 'Post-Disaster Needs Assessment (PDNA): Kerala Floods', source: 'UN, World Bank & Government of Kerala' },
    ],
  },
];

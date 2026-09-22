/**
 * PRALAYA Animation Engine — Scene Transitions
 * Defines scene identifiers, metadata, and transition triggers
 */

export const SCENES = {
  CALM: {
    id: 'calm',
    index: '01',
    title: 'The Calm',
    subtitle: 'Machhu-II Reservoir & Dam Structure',
    status: 'STEADY STATE',
  },
  BREACH: {
    id: 'breach',
    index: '02',
    title: 'The Breach',
    subtitle: 'Hypothetical Overtopping & Structural Failure',
    status: 'CRITICAL INUNDATION',
  },
  IMMERSION: {
    id: 'immersion',
    index: '03',
    title: 'The Immersion',
    subtitle: 'Hydrodynamic Surge & Aerial Perspective',
    status: 'ACTIVE PROPAGATION',
  },
  EDUCATION: {
    id: 'education',
    index: '04',
    title: 'Understanding Breaches',
    subtitle: 'Failure Mechanics & Machhu-II Historical Record',
    status: 'SCIENTIFIC VALIDATION',
  },
  SOLUTION: {
    id: 'solution',
    index: '05',
    title: 'PRALAYA Digital Twin',
    subtitle: '8-Directive End-to-End Decision Support Pipeline',
    status: 'PIPELINE ACTIVE',
  },
  FEATURES: {
    id: 'features',
    index: '06',
    title: 'Simulation & Action',
    subtitle: 'Scenario Exploration & Evacuation Sequencing',
    status: 'SYSTEM READY',
  },
};

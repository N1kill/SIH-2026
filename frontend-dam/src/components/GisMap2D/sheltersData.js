/**
 * PRALAYA — Emergency Shelters & HADR Logistics Data
 * Derived from scripts/14_risk_analysis.py and outputs/simulation/risk_analysis_summary.json
 * Topographically situated above >52.0m MSL safe contour line.
 */

export const SHELTERS = [
  {
    id: 1,
    name: 'Machhu Dam East Ridge Camp',
    shortName: 'Dam East Ridge',
    type: 'Crest Abutment High Ground Shelter',
    coords: [22.768, 70.925],
    elevation_m: 72.5,
    capacity: 12000,
    status: 'ACTIVE SAFE',
  },
  {
    id: 2,
    name: 'Gorge West Plateau Escarpment Hub',
    shortName: 'Gorge West',
    type: 'Western Plateau High-Ground Hub',
    coords: [22.785, 70.808],
    elevation_m: 68.0,
    capacity: 8500,
    status: 'ACTIVE SAFE',
  },
  {
    id: 3,
    name: 'Morbi South-East Relief Center',
    shortName: 'South-East',
    type: 'District Administrative High Ground',
    coords: [22.825, 70.928],
    elevation_m: 65.4,
    capacity: 18000,
    status: 'ACTIVE SAFE',
  },
  {
    id: 4,
    name: 'Morbi East High School Camp',
    shortName: 'East Ridge',
    type: 'Safe Ridge Relief Complex',
    coords: [22.855, 70.932],
    elevation_m: 62.8,
    capacity: 25000,
    status: 'ACTIVE SAFE',
  },
  {
    id: 5,
    name: 'Lilapar Northern Transit Hub',
    shortName: 'North Hub',
    type: 'High Ground Logistics Depot',
    coords: [22.895, 70.938],
    elevation_m: 61.5,
    capacity: 15000,
    status: 'ACTIVE SAFE',
  },
];

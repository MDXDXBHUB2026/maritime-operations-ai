export interface GeographicLabel {
  name: string;
  longitude: number;
  latitude: number;
  type: 'sea' | 'strait' | 'ocean' | 'gulf' | 'bay';
  minZoomDeg?: number; // only display if view degree span <= minZoomDeg
}

export interface MaritimePort {
  name: string;
  code: string;
  longitude: number;
  latitude: number;
}

export interface GeoFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties?: Record<string, unknown>;
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

/**
 * Prominent geographic water bodies and straits across the operational theatre
 */
export const MARITIME_GEOGRAPHIC_LABELS: GeographicLabel[] = [
  { name: 'ARABIAN GULF', longitude: 51.8, latitude: 27.2, type: 'gulf' },
  { name: 'STRAIT OF HORMUZ', longitude: 56.55, latitude: 26.6, type: 'strait' },
  { name: 'GULF OF OMAN', longitude: 59.2, latitude: 24.6, type: 'gulf' },
  { name: 'RED SEA', longitude: 38.2, latitude: 20.2, type: 'sea' },
  { name: 'ARABIAN SEA', longitude: 65.5, latitude: 17.5, type: 'sea' },
  { name: 'INDIAN OCEAN', longitude: 76.5, latitude: 3.5, type: 'ocean' },
  { name: 'BAY OF BENGAL', longitude: 88.5, latitude: 14.5, type: 'bay' },
  { name: 'STRAIT OF MALACCA', longitude: 100.8, latitude: 3.2, type: 'strait' },
  { name: 'SINGAPORE STRAIT', longitude: 103.9, latitude: 1.15, type: 'strait' },
];

/**
 * Major commercial ports along synthetic fleet routes
 */
export const MAJOR_MARITIME_PORTS: MaritimePort[] = [
  { name: 'Jebel Ali / Dubai', code: 'DXB', longitude: 55.05, latitude: 25.01 },
  { name: 'Khor Fakkan', code: 'KLF', longitude: 56.36, latitude: 25.35 },
  { name: 'Muscat / Sohar', code: 'MCT', longitude: 58.59, latitude: 23.61 },
  { name: 'Kuwait Port', code: 'KWI', longitude: 48.0, latitude: 29.38 },
  { name: 'Jeddah Islamic Port', code: 'JED', longitude: 39.17, latitude: 21.49 },
  { name: 'Mumbai Port', code: 'BOM', longitude: 72.88, latitude: 19.08 },
  { name: 'Chennai Port', code: 'MAA', longitude: 80.24, latitude: 12.97 },
  { name: 'Port of Singapore', code: 'SIN', longitude: 103.84, latitude: 1.26 },
];

/**
 * Primary commercial shipping corridors (waypoints connecting synthetic fleet)
 */
export const MAJOR_SHIPPING_LANES: [number, number][][] = [
  // Arabian Gulf through Strait of Hormuz to Arabian Sea
  [
    [48.0, 29.38],
    [50.2, 27.2],
    [54.8, 25.6],
    [56.34, 26.28], // Hormuz
    [57.5, 25.0],
    [59.5, 23.5],
    [64.0, 20.5],
    [71.5, 18.5],
  ],
  // Red Sea through Gulf of Aden into Arabian Sea
  [
    [39.17, 21.49],
    [41.5, 16.5],
    [43.3, 12.8],
    [48.0, 12.5],
    [54.0, 13.5],
    [62.0, 16.5],
    [71.5, 18.5],
  ],
  // Arabian Sea across southern India / Sri Lanka to Malacca & Singapore
  [
    [71.5, 18.5],
    [74.5, 13.0],
    [78.5, 7.5],
    [82.0, 5.8],
    [90.0, 5.8],
    [97.0, 5.5],
    [100.5, 3.5],
    [103.84, 1.26],
  ],
  // Bay of Bengal feeder corridor (Chennai to Malacca)
  [
    [80.24, 12.97],
    [86.0, 9.5],
    [93.0, 7.0],
    [98.5, 4.5],
    [103.84, 1.26],
  ],
];

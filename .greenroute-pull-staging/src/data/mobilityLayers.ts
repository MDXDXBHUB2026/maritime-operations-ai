export interface MobilityLayerDef {
  id: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  color: string;
  defaultEnabled: boolean;
}

export const MOBILITY_LAYERS: MobilityLayerDef[] = [
  { id: 'metro', nameEn: 'Metro', nameAr: 'المترو', icon: '🚆', color: '#0066FF', defaultEnabled: true },
  { id: 'bus', nameEn: 'Bus', nameAr: 'الحافلات', icon: '🚌', color: '#087F5B', defaultEnabled: true },
  { id: 'tram', nameEn: 'Tram', nameAr: 'الترام', icon: '🚊', color: '#8B5CF6', defaultEnabled: true },
  { id: 'cycling', nameEn: 'Cycling', nameAr: 'المسارات الرياضية', icon: '🚲', color: '#10B981', defaultEnabled: false },
  { id: 'walking', nameEn: 'Walking', nameAr: 'مسارات المشاة', icon: '🚶', color: '#20B486', defaultEnabled: true },
  { id: 'marine', nameEn: 'Marine', nameAr: 'النقل البحري', icon: '⛴️', color: '#06B6D4', defaultEnabled: false },
  { id: 'ev-charging', nameEn: 'EV Charging', nameAr: 'شواحن المركبات الكهربائية', icon: '⚡', color: '#F59E0B', defaultEnabled: false },
  { id: 'park-ride', nameEn: 'Park & Ride', nameAr: 'المواقف التنقلية', icon: '🅿️', color: '#3B82F6', defaultEnabled: false },
  { id: 'heat-zones', nameEn: 'Heat Zones', nameAr: 'مناطق التعرض للحرارة', icon: '☀️', color: '#EF4444', defaultEnabled: false },
  { id: 'accessibility', nameEn: 'Accessibility', nameAr: 'تسهيلات الوصول', icon: '♿', color: '#059669', defaultEnabled: true },
];

// GeoJSON Data for Static Map Layers
export const DUBAI_METRO_RED_LINE: GeoJSON.Feature = {
  type: 'Feature',
  properties: { name: 'Metro Red Line' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [55.1332, 25.0772], // Sobha Realty
      [55.1430, 25.0682], // DMCC
      [55.1560, 25.0963], // Dubai Internet City
      [55.1972, 25.1855], // Business Bay
      [55.2797, 25.1972], // Burj Khalifa / Dubai Mall
      [55.2818, 25.2100], // Financial Centre
      [55.3025, 25.2530], // BurJuman
      [55.3330, 25.2520], // Deira City Centre
    ],
  },
};

export const DUBAI_TRAM_LOOP: GeoJSON.Feature = {
  type: 'Feature',
  properties: { name: 'Dubai Tram Corridor' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [55.1332, 25.0772],
      [55.1390, 25.0810],
      [55.1430, 25.0850],
      [55.1480, 25.0890],
      [55.1530, 25.0930],
    ],
  },
};

export const DUBAI_MARINE_ROUTES: GeoJSON.Feature = {
  type: 'Feature',
  properties: { name: 'Dubai Canal Ferry' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [55.1300, 25.0750],
      [55.1600, 25.1200],
      [55.2200, 25.1700],
      [55.2600, 25.1880],
    ],
  },
};

export const EV_CHARGING_STATIONS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nameEn: 'DEWA Green Charger - Marina Mall', nameAr: 'شاحن ديوا - مارينا مول' },
      geometry: { type: 'Point', coordinates: [55.1380, 25.0760] },
    },
    {
      type: 'Feature',
      properties: { nameEn: 'DEWA Green Charger - Business Bay', nameAr: 'شاحن ديوا - الخليج التجاري' },
      geometry: { type: 'Point', coordinates: [55.2650, 25.1840] },
    },
    {
      type: 'Feature',
      properties: { nameEn: 'DEWA Green Charger - DIFC Gate', nameAr: 'شاحن ديوا - بوابة DIFC' },
      geometry: { type: 'Point', coordinates: [55.2810, 25.2110] },
    },
  ],
};

export const PARK_AND_RIDE_STATIONS: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { nameEn: 'DMCC Park & Ride (3,000 spaces)', nameAr: 'مواقف DMCC التنقلية (3000 موقف)' },
      geometry: { type: 'Point', coordinates: [55.1440, 25.0690] },
    },
    {
      type: 'Feature',
      properties: { nameEn: 'Centrepoint Park & Ride Hub', nameAr: 'مواقف سنتربوينت التنقلية' },
      geometry: { type: 'Point', coordinates: [55.3350, 25.2530] },
    },
  ],
};

export const HEAT_EXPOSURE_ZONES: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { level: 'high', nameEn: 'Unshaded Plaza', nameAr: 'ساحة مفتوحة غير مظللة' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [55.275, 25.195],
          [55.278, 25.195],
          [55.278, 25.198],
          [55.275, 25.198],
          [55.275, 25.195],
        ]],
      },
    },
  ],
};


import React, { useEffect, useRef, useState, useId, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Globe,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Navigation,
  Info,
  Flame,
  Leaf,
  Footprints,
  Trees,
  Fuel,
  Train,
  Bus,
  Bike,
  Ship,
  MapPin,
  Check,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { LocationItem, JourneyOption, JourneySegment, UserPreferences, TransportMode } from '../../types';
import { translations } from '../../data/translations';
import { MobilityCanvas } from './MobilityCanvas';
import { CountUp } from './CountUp';
import { FloatingSustainabilityCard } from './FloatingSustainabilityCard';
import {
  MOBILITY_LAYERS,
  DUBAI_METRO_RED_LINE,
  DUBAI_TRAM_LOOP,
  DUBAI_MARINE_ROUTES,
  EV_CHARGING_STATIONS,
  PARK_AND_RIDE_STATIONS,
  HEAT_EXPOSURE_ZONES,
} from '../../data/mobilityLayers';

interface InteractiveDubaiMobilityMapProps {
  origin: LocationItem | null;
  destination: LocationItem | null;
  selectedOption?: JourneyOption | null;
  allOptions?: JourneyOption[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  prefs: UserPreferences;
  onUpdatePrefs?: (newPrefs: Partial<UserPreferences>) => void;
  isOriginSelecting?: boolean;
  isDestinationSelecting?: boolean;
  isAnalyzing?: boolean;
  onOpenDetailsModal?: (journey: JourneyOption) => void;
}

// Dubai default center (Sheikh Zayed Road corridor)
const DUBAI_CENTER: [number, number] = [55.22, 25.15];
const DUBAI_DEFAULT_ZOOM = 11.5;

// Visual configuration for each transport mode
interface ModeConfig {
  key: string;
  nameEn: string;
  nameAr: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dashArray?: number[];
  iconChar: string;
  IconComponent: React.FC<{ className?: string }>;
}

const MODE_CONFIGS: Record<string, ModeConfig> = {
  walk: {
    key: 'walk',
    nameEn: 'Walk',
    nameAr: 'مشي',
    color: '#087F5B',
    bgColor: '#EAF3EE',
    borderColor: '#087F5B',
    dashArray: [2, 2],
    iconChar: '🚶',
    IconComponent: Footprints,
  },
  metro: {
    key: 'metro',
    nameEn: 'Metro',
    nameAr: 'مترو',
    color: '#0066FF',
    bgColor: '#E0F2FE',
    borderColor: '#0066FF',
    iconChar: '🚇',
    IconComponent: Train,
  },
  bus: {
    key: 'bus',
    nameEn: 'Bus',
    nameAr: 'حافلة',
    color: '#059669',
    bgColor: '#D1FAE5',
    borderColor: '#059669',
    iconChar: '🚌',
    IconComponent: Bus,
  },
  tram: {
    key: 'tram',
    nameEn: 'Tram',
    nameAr: 'ترام',
    color: '#8B5CF6',
    bgColor: '#F3E8FF',
    borderColor: '#8B5CF6',
    iconChar: '🚊',
    IconComponent: Train,
  },
  bicycle: {
    key: 'bicycle',
    nameEn: 'Cycling',
    nameAr: 'دراجة',
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#10B981',
    dashArray: [3, 2],
    iconChar: '🚲',
    IconComponent: Bike,
  },
  'e-scooter': {
    key: 'e-scooter',
    nameEn: 'E-Scooter',
    nameAr: 'سكوتر',
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#10B981',
    dashArray: [3, 2],
    iconChar: '🛴',
    IconComponent: Bike,
  },
  marine: {
    key: 'marine',
    nameEn: 'Marine Ferry',
    nameAr: 'النقل البحري',
    color: '#06B6D4',
    bgColor: '#CFFAFE',
    borderColor: '#06B6D4',
    dashArray: [4, 2],
    iconChar: '⛴️',
    IconComponent: Ship,
  },
  destination: {
    key: 'destination',
    nameEn: 'Destination',
    nameAr: 'الوجهة',
    color: '#102A2E',
    bgColor: '#F5F8F5',
    borderColor: '#102A2E',
    iconChar: '🏁',
    IconComponent: MapPin,
  },
};

export const InteractiveDubaiMobilityMap: React.FC<InteractiveDubaiMobilityMapProps> = ({
  origin,
  destination,
  selectedOption,
  allOptions = [],
  isExpanded = false,
  onToggleExpand,
  prefs,
  onUpdatePrefs,
  isOriginSelecting = false,
  isDestinationSelecting = false,
  isAnalyzing = false,
  onOpenDetailsModal,
}) => {
  const t = translations[prefs.language] || translations.en;
  const isRtl = prefs.language === 'ar';
  const shouldReduceMotion = useReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [hasMapError, setHasMapError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreenSheet, setIsFullscreenSheet] = useState(false);

  // Active Stage Index State
  const [activeStageIdx, setActiveStageIdx] = useState(0);

  // Animation Controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [animProgress, setAnimProgress] = useState(0); // 0 - 100%
  const [showAiCard, setShowAiCard] = useState(false);
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');

  // Active Map Layers State
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MOBILITY_LAYERS.forEach((l) => {
      initial[l.id] = l.defaultEnabled;
    });
    return initial;
  });

  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const carouselContainerRef = useRef<HTMLDivElement>(null);
  const stageCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const mapInstanceId = useId().replace(/:/g, '');

  // Build Unified Stages (Segments + Final Destination Stage)
  const segments = selectedOption?.segments || [];
  const totalStages = segments.length > 0 ? segments.length + 1 : 1;

  // Toggle Layer Helper
  const toggleLayer = (layerId: string) => {
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  // Language Switch Handlers
  const handleSetLanguage = (lang: 'en' | 'ar') => {
    if (onUpdatePrefs && prefs.language !== lang) {
      onUpdatePrefs({ language: lang });
    }
  };

  // Helper to get coordinates for each stage segment
  const getStageCoords = useCallback(
    (stageIdx: number): [number, number][] => {
      if (!selectedOption?.routeCoordinates || selectedOption.routeCoordinates.length === 0) {
        if (origin && destination) {
          return [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
          ];
        }
        return [DUBAI_CENTER, DUBAI_CENTER];
      }

      const allCoords = selectedOption.routeCoordinates;
      const totalSegs = segments.length || 1;

      if (stageIdx >= totalSegs) {
        // Destination point
        return [allCoords[allCoords.length - 1], allCoords[allCoords.length - 1]];
      }

      const totalPoints = allCoords.length;
      const startIndex = Math.floor((stageIdx / totalSegs) * (totalPoints - 1));
      const endIndex = Math.min(
        Math.floor(((stageIdx + 1) / totalSegs) * (totalPoints - 1)) + 1,
        totalPoints
      );

      const subCoords = allCoords.slice(startIndex, endIndex);
      if (subCoords.length < 2 && startIndex > 0) {
        return allCoords.slice(startIndex - 1, endIndex + 1);
      }
      return subCoords.length > 0 ? subCoords : allCoords;
    },
    [selectedOption, segments.length, origin, destination]
  );

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            'premium-street-tiles': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors © CARTO',
            },
          },
          layers: [
            {
              id: 'premium-street-tiles-layer',
              type: 'raster',
              source: 'premium-street-tiles',
              minzoom: 0,
              maxzoom: 19,
              paint: {
                'raster-saturation': -0.05,
                'raster-contrast': 0.08,
                'raster-brightness-min': 0.08,
                'raster-brightness-max': 0.98,
              },
            },
          ],
        },
        center: DUBAI_CENTER,
        zoom: DUBAI_DEFAULT_ZOOM,
        pitch: 35,
        bearing: -15,
        attributionControl: false,
      });

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        setMapLoaded(true);

        // Sources
        map.addSource('primary-route-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addSource('active-segment-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addSource('animated-vehicle-trail-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addSource('alt-routes-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Layer Sources for Mobility Overlay
        map.addSource('metro-line-source', { type: 'geojson', data: DUBAI_METRO_RED_LINE });
        map.addSource('tram-loop-source', { type: 'geojson', data: DUBAI_TRAM_LOOP });
        map.addSource('marine-route-source', { type: 'geojson', data: DUBAI_MARINE_ROUTES });
        map.addSource('ev-charging-source', { type: 'geojson', data: EV_CHARGING_STATIONS });
        map.addSource('park-ride-source', { type: 'geojson', data: PARK_AND_RIDE_STATIONS });
        map.addSource('heat-zones-source', { type: 'geojson', data: HEAT_EXPOSURE_ZONES });

        // Layer Renderings

        // Metro Layer Line
        map.addLayer({
          id: 'layer-metro',
          type: 'line',
          source: 'metro-line-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0066FF',
            'line-width': 4,
            'line-opacity': 0.85,
          },
        });

        // Tram Layer Line
        map.addLayer({
          id: 'layer-tram',
          type: 'line',
          source: 'tram-loop-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#8B5CF6',
            'line-width': 3.5,
            'line-opacity': 0.8,
          },
        });

        // Marine Layer Line
        map.addLayer({
          id: 'layer-marine',
          type: 'line',
          source: 'marine-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#06B6D4',
            'line-width': 3,
            'line-dasharray': [3, 2],
            'line-opacity': 0.85,
          },
        });

        // Heat Zones Layer Polygon
        map.addLayer({
          id: 'layer-heat-zones',
          type: 'fill',
          source: 'heat-zones-source',
          paint: {
            'fill-color': '#EF4444',
            'fill-opacity': 0.25,
          },
        });

        // Alternative Routes Layer
        map.addLayer({
          id: 'alt-routes-layer',
          type: 'line',
          source: 'alt-routes-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#607276',
            'line-width': 3,
            'line-dasharray': [2, 2],
            'line-opacity': 0.45,
          },
        });

        // Primary Route Base Glow
        map.addLayer({
          id: 'primary-route-glow',
          type: 'line',
          source: 'primary-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 13,
            'line-opacity': 0.95,
          },
        });

        // Primary Route Line
        map.addLayer({
          id: 'primary-route-layer',
          type: 'line',
          source: 'primary-route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#1A73E8',
            'line-width': 7,
            'line-opacity': 0.96,
          },
        });

        // Active Segment Highlight Line
        map.addLayer({
          id: 'active-segment-glow',
          type: 'line',
          source: 'active-segment-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 16,
            'line-opacity': 0.98,
          },
        });

        map.addLayer({
          id: 'active-segment-layer',
          type: 'line',
          source: 'active-segment-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0B57D0',
            'line-width': 9,
            'line-opacity': 1.0,
          },
        });

        // Animated vehicle trail casing keeps the path visible over roads and labels.
        map.addLayer({
          id: 'animated-vehicle-trail-casing-layer',
          type: 'line',
          source: 'animated-vehicle-trail-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 15,
            'line-opacity': 0.96,
          },
        });

        // Animated Vehicle Trail Overlay
        map.addLayer({
          id: 'animated-vehicle-trail-layer',
          type: 'line',
          source: 'animated-vehicle-trail-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0B57D0',
            'line-width': 11,
            'line-opacity': 1,
          },
        });
      });

      map.on('error', (e) => {
        console.warn('MapLibre tile notice:', e);
      });

      mapRef.current = map;
    } catch (err) {
      console.warn('MapLibre init fallback:', err);
      setHasMapError(true);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Synchronize Map Layers Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const toggleVis = (layerId: string, enabled: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', enabled ? 'visible' : 'none');
      }
    };

    toggleVis('layer-metro', !!activeLayers['metro']);
    toggleVis('layer-tram', !!activeLayers['tram']);
    toggleVis('layer-marine', !!activeLayers['marine']);
    toggleVis('layer-heat-zones', !!activeLayers['heat-zones']);
  }, [activeLayers, mapLoaded]);

  // Handle ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isFullscreenSheet, isExpanded]);

  // Update Origin and Destination Markers on Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    if (origin) {
      const el = document.createElement('div');
      el.className = 'origin-animated-marker';
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="position: absolute; width: 38px; height: 38px; background: rgba(8, 127, 91, 0.3); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="background: linear-gradient(135deg, #087F5B, #20B486); color: white; border: 2.5px solid white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; box-shadow: 0 6px 14px rgba(0,0,0,0.25);">A</div>
          <div style="background: #102A2E; color: white; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 10px; margin-top: 3px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2);">${isRtl ? origin.nameAr : origin.nameEn}</div>
        </div>
      `;

      originMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([origin.lng, origin.lat])
        .addTo(map);
    }

    if (destination) {
      const el = document.createElement('div');
      el.className = 'dest-animated-marker';
      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="position: absolute; width: 38px; height: 38px; background: rgba(8, 42, 50, 0.3); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="background: linear-gradient(135deg, #102A2E, #082A32); color: white; border: 2.5px solid white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; box-shadow: 0 6px 14px rgba(0,0,0,0.25);">B</div>
          <div style="background: #082A32; color: white; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 10px; margin-top: 3px; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2);">${isRtl ? destination.nameAr : destination.nameEn}</div>
        </div>
      `;

      destMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map);
    }

    if (origin && destination) {
      const bounds = new maplibregl.LngLatBounds()
        .extend([origin.lng, origin.lat])
        .extend([destination.lng, destination.lat]);

      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 80, left: 60, right: 60 },
        pitch: 35,
        duration: 900,
        maxZoom: 14.5,
      });
    }
  }, [origin, destination, mapLoaded, isRtl]);

  // Handle Stage Selection (Synchronises Carousel, Map Camera, Segment Highlight, ARIA)
  const handleSelectStage = useCallback(
    (stageIdx: number, userInitiated = true) => {
      const clampedIdx = Math.max(0, Math.min(stageIdx, totalStages - 1));
      setActiveStageIdx(clampedIdx);

      // 1. Scroll stage card into view inside carousel
      if (stageCardRefs.current[clampedIdx]) {
        stageCardRefs.current[clampedIdx]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }

      // 2. Update Map Segment Source & Camera
      const map = mapRef.current;
      if (map && mapLoaded && selectedOption?.routeCoordinates) {
        const activeSegSource = map.getSource('active-segment-source') as maplibregl.GeoJSONSource;
        const subCoords = getStageCoords(clampedIdx);

        if (activeSegSource) {
          activeSegSource.setData({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: subCoords },
          });

          // Google-style navigation treatment: every active travel path stays blue.
          if (map.getLayer('active-segment-layer')) {
            map.setPaintProperty('active-segment-layer', 'line-color', '#0B57D0');
            map.setPaintProperty('active-segment-glow', 'line-color', '#FFFFFF');
            map.setPaintProperty('active-segment-layer', 'line-dasharray', [1, 0]);
          }
        }

        // Fly camera to current segment bounds
        if (subCoords.length >= 2) {
          const bounds = new maplibregl.LngLatBounds();
          subCoords.forEach((pt) => bounds.extend(pt));
          map.fitBounds(bounds, {
            padding: { top: 80, bottom: 120, left: 60, right: 60 },
            maxZoom: 15.5,
            duration: 700,
          });
        }
      }

      // 3. ARIA Live Announcement
      if (userInitiated) {
        const currentSeg = segments[clampedIdx];
        const isDest = clampedIdx === segments.length;
        const stageTitle = isDest
          ? `${t.destination}: ${isRtl ? destination?.nameAr : destination?.nameEn}`
          : isRtl
          ? currentSeg?.titleAr
          : currentSeg?.titleEn;

        setAnnouncementText(`${t.stage} ${clampedIdx + 1} ${t.stageOf} ${totalStages}: ${stageTitle}`);
      }
    },
    [totalStages, mapLoaded, selectedOption, segments, getStageCoords, t, isRtl, destination]
  );

  // Synchronise Primary Route Data & Animated Marker Loop
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const primarySource = map.getSource('primary-route-source') as maplibregl.GeoJSONSource;
    const trailSource = map.getSource('animated-vehicle-trail-source') as maplibregl.GeoJSONSource;
    const altSource = map.getSource('alt-routes-source') as maplibregl.GeoJSONSource;

    if (!primarySource || !altSource) return;

    if (selectedOption && selectedOption.routeCoordinates && selectedOption.routeCoordinates.length > 0) {
      const coords = selectedOption.routeCoordinates;

      primarySource.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      });

      // Alternative Routes
      const altFeatures = allOptions
        .filter((opt) => opt.id !== selectedOption.id && opt.routeCoordinates)
        .map((opt) => ({
          type: 'Feature' as const,
          properties: { category: opt.category },
          geometry: { type: 'LineString' as const, coordinates: opt.routeCoordinates! },
        }));

      altSource.setData({ type: 'FeatureCollection', features: altFeatures });

      // Create or update moving vehicle marker with mode-specific status badge & pulse ring
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.remove();
        vehicleMarkerRef.current = null;
      }

      const vehicleEl = document.createElement('div');
      vehicleEl.className = 'moving-vehicle-icon-marker';
      vehicleEl.style.transition = 'all 80ms linear';
      vehicleEl.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
          <div id="vehicle-tooltip-${mapInstanceId}" style="position: absolute; top: -42px; background: rgba(16, 42, 46, 0.92); color: #ffffff; padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 800; white-space: nowrap; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 6px 16px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 5px; transition: all 150ms ease;">
            <span id="vehicle-tooltip-icon-${mapInstanceId}">🚶</span>
            <span id="vehicle-tooltip-text-${mapInstanceId}">Walk • 0%</span>
          </div>
          <div id="vehicle-pulse-ring-${mapInstanceId}" style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background: rgba(8, 127, 91, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div id="vehicle-inner-icon-${mapInstanceId}" style="background: #087F5B; color: white; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 8px 22px rgba(0,0,0,0.32); transform: scale(1.1); transition: background-color 250ms ease, transform 200ms ease;">
            🚶
          </div>
        </div>
      `;

      const vehicleMarker = new maplibregl.Marker({ element: vehicleEl })
        .setLngLat(coords[0])
        .addTo(map);

      vehicleMarkerRef.current = vehicleMarker;

      let progressIdx = 0;
      const totalPoints = coords.length;
      setShowAiCard(false);

      const animateVehicle = () => {
        if (!isPlaying) return;

        progressIdx += 0.07;
        if (progressIdx >= totalPoints - 1) {
          progressIdx = totalPoints - 1;
          setAnimProgress(100);
          setShowAiCard(true);
          setActiveStageIdx(totalStages - 1);
          return;
        }

        const currIdx = Math.floor(progressIdx);
        const nextIdx = Math.min(currIdx + 1, totalPoints - 1);
        const fraction = progressIdx - currIdx;

        const lng = coords[currIdx][0] + (coords[nextIdx][0] - coords[currIdx][0]) * fraction;
        const lat = coords[currIdx][1] + (coords[nextIdx][1] - coords[currIdx][1]) * fraction;

        vehicleMarker.setLngLat([lng, lat]);

        const pct = Math.round((progressIdx / (totalPoints - 1)) * 100);
        setAnimProgress(pct);

        // Compute corresponding stage index from progress
        const computedStage = Math.min(
          Math.floor((pct / 100) * totalStages),
          totalStages - 1
        );

        if (computedStage !== activeStageIdx) {
          handleSelectStage(computedStage, false);
        }

        // Mode-specific configuration & elements update
        const currentSeg = segments[computedStage];
        const modeKey = currentSeg?.mode || (computedStage === segments.length ? 'destination' : 'walk');
        const config = MODE_CONFIGS[modeKey] || MODE_CONFIGS.walk;
        const modeTitle = isRtl ? config.nameAr : config.nameEn;

        const innerIconEl = document.getElementById(`vehicle-inner-icon-${mapInstanceId}`);
        const tooltipTextEl = document.getElementById(`vehicle-tooltip-text-${mapInstanceId}`);
        const tooltipIconEl = document.getElementById(`vehicle-tooltip-icon-${mapInstanceId}`);
        const pulseRingEl = document.getElementById(`vehicle-pulse-ring-${mapInstanceId}`);

        if (innerIconEl) {
          innerIconEl.innerText = config.iconChar;
          innerIconEl.style.background = config.color;
        }
        if (tooltipTextEl) {
          tooltipTextEl.innerText = `${modeTitle} • ${pct}%`;
        }
        if (tooltipIconEl) {
          tooltipIconEl.innerText = config.iconChar;
        }
        if (pulseRingEl) {
          pulseRingEl.style.background = `${config.color}3D`; // 24% opacity
        }

        // Keep the travelled path visually consistent with premium navigation maps.
        if (map.getLayer('animated-vehicle-trail-layer')) {
          map.setPaintProperty('animated-vehicle-trail-layer', 'line-color', '#0B57D0');
          map.setPaintProperty(
            'animated-vehicle-trail-layer',
            'line-width',
            modeKey === 'metro' || modeKey === 'tram' ? 12 : 10
          );
          map.setPaintProperty('animated-vehicle-trail-layer', 'line-opacity', 1);
        }

        // Draw animated trail behind vehicle in real time
        if (trailSource) {
          const drawnCoords = coords.slice(0, currIdx + 1);
          drawnCoords.push([lng, lat]);
          trailSource.setData({
            type: 'Feature',
            properties: { mode: modeKey },
            geometry: { type: 'LineString', coordinates: drawnCoords },
          });
        }

        animFrameRef.current = requestAnimationFrame(animateVehicle);
      };

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(animateVehicle);
      }
    } else {
      primarySource.setData({ type: 'FeatureCollection', features: [] });
      trailSource.setData({ type: 'FeatureCollection', features: [] });
      altSource.setData({ type: 'FeatureCollection', features: [] });
      setAnimProgress(0);
      setShowAiCard(false);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [selectedOption, allOptions, mapLoaded, isPlaying, totalStages, segments, handleSelectStage]);

  // Recentre Camera
  const handleRecentre = () => {
    const map = mapRef.current;
    if (!map) return;
    if (origin && destination) {
      const bounds = new maplibregl.LngLatBounds()
        .extend([origin.lng, origin.lat])
        .extend([destination.lng, destination.lat]);
      map.fitBounds(bounds, { padding: 60, pitch: 35, duration: 700 });
    } else {
      map.easeTo({ center: DUBAI_CENTER, zoom: DUBAI_DEFAULT_ZOOM, pitch: 20, duration: 600 });
    }
  };

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 300 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 300 });

  // Replay Route Animation
  const handleReplayAnimation = () => {
    setAnimProgress(0);
    setActiveStageIdx(0);
    setShowAiCard(false);
    setIsPlaying(true);
    handleSelectStage(0, true);
  };

  // Previous & Next Stage Handlers
  const handlePrevStage = () => {
    if (activeStageIdx > 0) {
      handleSelectStage(activeStageIdx - 1, true);
    }
  };

  const handleNextStage = () => {
    if (activeStageIdx < totalStages - 1) {
      handleSelectStage(activeStageIdx + 1, true);
    }
  };

  // Fallback Canvas
  if (hasMapError) {
    return (
      <div className="relative rounded-3xl overflow-hidden border border-[#DCE6E1] bg-[#F5F8F5] shadow-xs p-2">
        <MobilityCanvas
          origin={origin || { id: 'dubai-internet-city', nameEn: 'Dubai Internet City', nameAr: 'مدينة دبي للأنتظرنت', zone: '1', metroStation: 'DIC', lat: 25.09, lng: 55.15, category: 'hub', districtEn: 'DIC', districtAr: 'DIC', accessibilityInfoEn: '', accessibilityInfoAr: '', nearbyModes: ['metro'] }}
          destination={destination || { id: 'dubai-mall', nameEn: 'Dubai Mall', nameAr: 'دبي مول', zone: '1', metroStation: 'Burj Khalifa', lat: 25.20, lng: 55.27, category: 'retail', districtEn: 'Downtown', districtAr: 'وسط المدينة', accessibilityInfoEn: '', accessibilityInfoAr: '', nearbyModes: ['metro'] }}
          activeMobilityNeed={prefs.reducedWalking ? 'reduced-walking' : 'standard'}
          isEvaluating={isAnalyzing}
          language={prefs.language}
        />
        <div className="mt-2 bg-white/90 backdrop-blur-xs p-2 rounded-xl text-[10px] text-[#607276] font-bold flex items-center gap-1.5 border border-[#DCE6E1]">
          <AlertCircle className="w-3.5 h-3.5 text-[#B7791F] shrink-0" />
          <span>{t.mapFallbackNotice}</span>
        </div>
      </div>
    );
  }

  // Determine current active stage instruction banner
  const activeSeg = segments[activeStageIdx];
  const isFinalDestinationStage = activeStageIdx === segments.length;
  const currentModeKey = activeSeg?.mode || (isFinalDestinationStage ? 'destination' : 'walk');
  const currentModeConfig = MODE_CONFIGS[currentModeKey] || MODE_CONFIGS.walk;

  const currentInstructionText = isFinalDestinationStage
    ? isRtl
      ? `وصلت إلى وجهتك: ${destination?.nameAr || 'الوجهة'}`
      : `Arrived at your destination: ${destination?.nameEn || 'Destination'}`
    : isRtl
    ? activeSeg?.titleAr
    : activeSeg?.titleEn;

  return (
    <div className="relative w-full space-y-3">
      {/* ARIA Live Region for Accessibility Announcements */}
      <div aria-live="polite" className="sr-only" role="status">
        {announcementText}
      </div>

      {/* Interactive Map Shell Container */}
      <div
        className={`relative w-full rounded-3xl overflow-hidden border border-slate-200 bg-[#EAF3EE] shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition-all ${
          isExpanded ? 'h-[440px]' : 'h-[320px] sm:h-[360px]'
        }`}
      >
        {/* Map Canvas */}
        <div ref={containerRef} className="w-full h-full min-h-[300px]" id={`maplibre-container-${mapInstanceId}`} />

        {/* Soft Ambient Inner Glow Edge */}
        <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-black/5 rounded-3xl shadow-inner" />

        {/* Top Floating Control Header Bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-30 pointer-events-none">
          {/* Status Badge */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {isAnalyzing ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#102A2E]/95 text-white px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-md border border-[#20B486]/40"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#20B486] animate-spin" />
                <span>{t.analysingJourney}...</span>
              </motion.div>
            ) : selectedOption ? (
              <div className="bg-white/95 backdrop-blur-md text-[#102A2E] border border-[#DCE6E1] px-3 py-1 rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-[#087F5B] animate-pulse" />
                <span>
                  {t.journeyProgress}: {animProgress}%
                </span>
              </div>
            ) : isOriginSelecting ? (
              <div className="bg-[#087F5B] text-white px-3 py-1 rounded-2xl text-[11px] font-extrabold flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>{t.startingPointPrompt}</span>
              </div>
            ) : (
              <div className="bg-white/90 backdrop-blur-xs text-[#102A2E] border border-[#DCE6E1] px-2.5 py-1 rounded-xl text-[11px] font-bold">
                🌱 Dubai Green Route
              </div>
            )}
          </div>

          {/* Quick Actions (Bilingual Language Switcher, Layer Toggle, Replay, Fullscreen) */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {/* Bilingual Language Switcher Segmented Button */}
            <div
              className="bg-white/95 backdrop-blur-md p-0.5 rounded-2xl border border-[#DCE6E1] shadow-2xs flex items-center"
              role="group"
              aria-label="Language Selector"
            >
              <button
                type="button"
                onClick={() => handleSetLanguage('en')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all min-h-[32px] min-w-[36px] flex items-center justify-center ${
                  prefs.language === 'en'
                    ? 'bg-[#087F5B] text-white shadow-xs'
                    : 'text-[#607276] hover:text-[#102A2E]'
                }`}
                aria-pressed={prefs.language === 'en'}
                aria-label="Switch language to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleSetLanguage('ar')}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all min-h-[32px] min-w-[36px] flex items-center justify-center ${
                  prefs.language === 'ar'
                    ? 'bg-[#087F5B] text-white shadow-xs'
                    : 'text-[#607276] hover:text-[#102A2E]'
                }`}
                aria-pressed={prefs.language === 'ar'}
                aria-label="التحويل إلى اللغة العربية"
              >
                عربي
              </button>
            </div>

            {/* Layer Toggle Button */}
            <button
              type="button"
              onClick={() => setShowLayerDrawer(!showLayerDrawer)}
              className={`min-h-[36px] min-w-[36px] p-2 rounded-2xl border shadow-2xs text-xs font-bold flex items-center justify-center transition-all ${
                showLayerDrawer
                  ? 'bg-[#087F5B] text-white border-[#087F5B]'
                  : 'bg-white/95 text-[#102A2E] border-[#DCE6E1] hover:bg-[#EAF3EE]'
              }`}
              title={t.mobilityLayersTitle}
              aria-label={t.mobilityLayersTitle}
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Replay Animation */}
            {selectedOption && (
              <button
                type="button"
                onClick={handleReplayAnimation}
                className="min-h-[36px] min-w-[36px] p-2 rounded-2xl bg-white/95 text-[#102A2E] border border-[#DCE6E1] shadow-2xs hover:bg-[#EAF3EE] transition-all flex items-center justify-center"
                title={t.replayAnimation}
                aria-label={t.replayAnimation}
              >
                <RotateCcw className="w-4 h-4 text-[#087F5B]" />
              </button>
            )}

            {/* Expand Sheet */}
            <button
              type="button"
              onClick={() => setIsFullscreenSheet(true)}
              className="min-h-[36px] min-w-[36px] p-2 rounded-2xl bg-white/95 text-[#102A2E] border border-[#DCE6E1] shadow-2xs hover:bg-[#EAF3EE] transition-all flex items-center justify-center"
              title={t.mapExpand}
              aria-label={t.mapExpand}
            >
              <Maximize2 className="w-4 h-4 text-[#087F5B]" />
            </button>
          </div>
        </div>

        {/* Live Mobility Layers Drawer */}
        <AnimatePresence>
          {showLayerDrawer && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-14 left-3 right-3 z-30 bg-white/95 backdrop-blur-lg border border-[#DCE6E1] rounded-2xl p-3 shadow-xl space-y-2 pointer-events-auto"
            >
              <div className="flex items-center justify-between border-b border-[#DCE6E1] pb-1.5">
                <span className="text-xs font-black text-[#102A2E] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>{t.mobilityLayersTitle}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowLayerDrawer(false)}
                  className="text-[10px] font-bold text-[#607276] hover:text-[#102A2E] min-h-[32px] px-2"
                >
                  {t.close}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                {MOBILITY_LAYERS.map((layer) => {
                  const active = !!activeLayers[layer.id];
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => toggleLayer(layer.id)}
                      className={`min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-bold flex items-center justify-between border transition-all ${
                        active
                          ? 'bg-[#EAF3EE] border-[#087F5B] text-[#087F5B]'
                          : 'bg-[#F5F8F5] border-[#DCE6E1] text-[#607276] hover:bg-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{layer.icon}</span>
                        <span className="truncate">{isRtl ? layer.nameAr : layer.nameEn}</span>
                      </span>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-[#087F5B] shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Instruction Banner Overlay (Mid Map Top) */}
        {selectedOption && (
          <div className="absolute top-14 left-3 right-3 z-20 pointer-events-none flex justify-center">
            <motion.div
              key={activeStageIdx}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#102A2E]/95 backdrop-blur-md text-white px-3.5 py-1.5 rounded-2xl border border-[#20B486]/40 shadow-md text-xs font-bold flex items-center gap-2 max-w-full truncate"
            >
              <span
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0"
                style={{ backgroundColor: currentModeConfig.color }}
              >
                {currentModeConfig.iconChar}
              </span>
              <span className="truncate">{currentInstructionText}</span>
            </motion.div>
          </div>
        )}

        {/* Map Zoom Controls at Bottom Right */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-xl bg-white/95 text-[#102A2E] border border-[#DCE6E1] shadow-xs flex items-center justify-center font-black text-sm hover:bg-[#EAF3EE] focus:ring-2 focus:ring-[#087F5B]"
            title={t.zoomIn}
            aria-label={t.zoomIn}
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-xl bg-white/95 text-[#102A2E] border border-[#DCE6E1] shadow-xs flex items-center justify-center font-black text-sm hover:bg-[#EAF3EE] focus:ring-2 focus:ring-[#087F5B]"
            title={t.zoomOut}
            aria-label={t.zoomOut}
          >
            −
          </button>
        </div>
      </div>

      {/* Requirement 2 & 3: Functional Horizontal Journey-Stage Carousel with Arrows & Mode Differentiation */}
      {selectedOption && (
        <div className="bg-white border border-[#DCE6E1] p-3 rounded-3xl shadow-sm space-y-2.5 relative">
          {/* Header Row: Stage Counter & Animation Controls */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#102A2E] uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-[#087F5B]" />
                <span>
                  {t.stage} {activeStageIdx + 1} {t.stageOf} {totalStages}
                </span>
              </span>
              <span className="bg-[#EAF3EE] text-[#087F5B] border border-[#20B486]/30 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                {currentModeConfig.iconChar} {isRtl ? currentModeConfig.nameAr : currentModeConfig.nameEn}
              </span>
            </div>

            {/* Stage Controls: Play/Pause, Replay, Arrows */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-8 h-8 rounded-xl bg-[#F5F8F5] border border-[#DCE6E1] text-[#102A2E] hover:bg-[#EAF3EE] flex items-center justify-center transition-all min-h-[32px] min-w-[32px]"
                title={isPlaying ? t.pauseAnimation : t.playAnimation}
                aria-label={isPlaying ? t.pauseAnimation : t.playAnimation}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 text-[#087F5B]" /> : <Play className="w-3.5 h-3.5 text-[#087F5B] ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={handlePrevStage}
                disabled={activeStageIdx === 0}
                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all min-h-[32px] min-w-[32px] ${
                  activeStageIdx === 0
                    ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'bg-[#F5F8F5] border-[#DCE6E1] text-[#102A2E] hover:bg-[#EAF3EE]'
                }`}
                title={t.prevStage}
                aria-label={t.prevStage}
              >
                {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleNextStage}
                disabled={activeStageIdx === totalStages - 1}
                className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all min-h-[32px] min-w-[32px] ${
                  activeStageIdx === totalStages - 1
                    ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'bg-[#F5F8F5] border-[#DCE6E1] text-[#102A2E] hover:bg-[#EAF3EE]'
                }`}
                title={t.nextStage}
                aria-label={t.nextStage}
              >
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Horizontal Journey-Stage Carousel Container */}
          <div
            ref={carouselContainerRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory px-1 py-1"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {Array.from({ length: totalStages }).map((_, idx) => {
              const isDestStage = idx === segments.length;
              const seg = segments[idx];

              const modeKey = isDestStage ? 'destination' : seg?.mode || 'walk';
              const config = MODE_CONFIGS[modeKey] || MODE_CONFIGS.walk;
              const isActive = idx === activeStageIdx;

              const titleText = isDestStage
                ? isRtl
                  ? destination?.nameAr || 'الوجهة'
                  : destination?.nameEn || 'Destination'
                : isRtl
                ? seg?.titleAr
                : seg?.titleEn;

              const durationText = isDestStage ? t.destination : `${seg?.durationMin || 4} ${t.min}`;

              const distanceText = isDestStage
                ? isRtl
                  ? 'تمت الرحلة بنجاح'
                  : 'Journey completed'
                : seg?.mode === 'metro' || seg?.mode === 'bus' || seg?.mode === 'tram'
                ? isRtl
                  ? `${origin?.nameAr.split(' ')[0]} ← ${destination?.nameAr.split(' ')[0]}`
                  : `${origin?.nameEn.split(' ')[0]} to ${destination?.nameEn.split(' ')[0]}`
                : isRtl
                ? `${(seg?.durationMin || 4) * 70} متر`
                : `${(seg?.durationMin || 4) * 70} m`;

              const Icon = config.IconComponent;

              return (
                <div
                  key={seg?.id || `stage-${idx}`}
                  ref={(el) => {
                    stageCardRefs.current[idx] = el;
                  }}
                  onClick={() => handleSelectStage(idx, true)}
                  className={`w-[250px] sm:w-[280px] shrink-0 p-3.5 rounded-2xl border-2 transition-all cursor-pointer snap-center select-none relative ${
                    isActive
                      ? 'bg-white shadow-md scale-[1.02] ring-2 ring-[#087F5B]/20'
                      : 'bg-[#F5F8F5] border-[#DCE6E1] text-[#607276] opacity-85 hover:opacity-100 hover:border-[#20B486]/50'
                  }`}
                  style={{
                    borderColor: isActive ? config.borderColor : '#DCE6E1',
                    backgroundColor: isActive ? config.bgColor : '#F5F8F5',
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelectStage(idx, true);
                    }
                  }}
                >
                  {/* Top Card Line: Icon + Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs transition-transform ${
                          isActive ? 'scale-110 ring-2 ring-white' : ''
                        }`}
                        style={{ backgroundColor: config.color, color: 'white' }}
                      >
                        <Icon className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: config.color }}>
                          {isRtl ? config.nameAr : config.nameEn}
                        </span>
                        <span className="text-xs font-black text-[#102A2E] block truncate max-w-[140px]">
                          {titleText}
                        </span>
                      </div>
                    </div>

                    {/* Active Stage Indicator Badge */}
                    {isActive ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white flex items-center gap-1 shadow-2xs shrink-0"
                        style={{ backgroundColor: config.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <span>{t.currentStage}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#607276] bg-white border border-[#DCE6E1] px-2 py-0.5 rounded-full shrink-0">
                        {idx < activeStageIdx ? t.completedStage : t.upcomingStage}
                      </span>
                    )}
                  </div>

                  {/* Card Metrics & Instructions */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[#102A2E] font-bold pt-1 border-t border-black/5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#087F5B]" />
                        <span>{durationText}</span>
                      </span>
                      <span className="text-[11px] text-[#607276] font-semibold">{distanceText}</span>
                    </div>

                    {/* Accessibility & Heat Note preview if active */}
                    {isActive && seg && (
                      <p className="text-[10px] text-[#087F5B] font-extrabold bg-white/80 p-1.5 rounded-xl border border-[#20B486]/30 truncate mt-1">
                        ♿ {isRtl ? seg.accessibilityNoteAr : seg.accessibilityNoteEn}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Dots Indicator */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {Array.from({ length: totalStages }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectStage(idx, true)}
                className={`h-2 rounded-full transition-all ${
                  idx === activeStageIdx ? 'w-6 bg-[#087F5B]' : 'w-2 bg-[#DCE6E1] hover:bg-[#20B486]'
                }`}
                title={`${t.stage} ${idx + 1}`}
                aria-label={`${t.stage} ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Requirement 6: Clear Journey Progress Timeline (Positioned Safely Below Map/Carousel) */}
      {selectedOption && (
        <div className="bg-white border border-[#DCE6E1] p-3.5 rounded-3xl shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#DCE6E1] pb-2">
            <h4 className="text-xs font-black text-[#102A2E] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#087F5B]" />
              <span>{t.journeyProgress}</span>
            </h4>
            <span className="text-[11px] font-bold text-[#087F5B] bg-[#EAF3EE] px-2.5 py-0.5 rounded-full border border-[#20B486]/30">
              {activeStageIdx + 1} / {totalStages} {t.stageOf}
            </span>
          </div>

          {/* Timeline List (Horizontal / Responsive Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Array.from({ length: totalStages }).map((_, idx) => {
              const isDest = idx === segments.length;
              const seg = segments[idx];
              const modeKey = isDest ? 'destination' : seg?.mode || 'walk';
              const config = MODE_CONFIGS[modeKey] || MODE_CONFIGS.walk;

              const isCompleted = idx < activeStageIdx;
              const isCurrent = idx === activeStageIdx;

              const stageName = isDest
                ? isRtl
                  ? destination?.nameAr || 'الوجهة'
                  : destination?.nameEn || 'Destination'
                : isRtl
                ? seg?.titleAr
                : seg?.titleEn;

              return (
                <div
                  key={idx}
                  onClick={() => handleSelectStage(idx, true)}
                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                    isCurrent
                      ? 'bg-[#EAF3EE] border-[#087F5B] text-[#087F5B] shadow-xs'
                      : isCompleted
                      ? 'bg-white border-[#20B486]/40 text-[#087F5B]'
                      : 'bg-[#F5F8F5] border-[#DCE6E1] text-[#607276]'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                    style={{ backgroundColor: config.color }}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : config.iconChar}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[10px] font-extrabold uppercase">
                      <span style={{ color: config.color }}>
                        {t.stage} {idx + 1} • {isRtl ? config.nameAr : config.nameEn}
                      </span>
                      <span>{isDest ? '🏁' : `${seg?.durationMin || 4} ${t.min}`}</span>
                    </div>
                    <p className="text-xs font-bold truncate text-[#102A2E] mt-0.5">{stageName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Animated Sustainability Card */}
      {selectedOption && (
        <FloatingSustainabilityCard
          selectedOption={selectedOption}
          language={prefs.language}
          onOpenDetailsModal={onOpenDetailsModal}
        />
      )}

      {/* AI Sustainable Route Explanation Card */}
      <AnimatePresence>
        {selectedOption && (showAiCard || animProgress >= 100) && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-gradient-to-br from-[#102A2E] via-[#0E2327] to-[#082A32] text-white p-4.5 rounded-3xl border border-[#20B486]/40 shadow-xl space-y-3 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#20B486]/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#087F5B] text-white flex items-center justify-center shadow-md">
                  🌱
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#34D399] flex items-center gap-1.5">
                    <span>{t.whyGreenestRouteTitle}</span>
                  </h3>
                  <p className="text-[11px] text-white/80 font-medium mt-0.5">
                    {t.reducesCarbonNotice} <strong className="text-[#34D399]">{selectedOption.co2SavedKg} kg CO₂e</strong>{' '}
                    {t.comparedToDriving}
                  </p>
                </div>
              </div>

              <span className="bg-[#20B486]/20 border border-[#20B486]/40 text-[#34D399] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                AI Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-white/95 pt-1">
              {[
                t.benefitMetroShare,
                t.benefitAvoidsCongestion,
                t.benefitReducesSunlight,
                t.benefitStepFreeStations,
                t.benefitSavesParking,
                t.benefitEmissionsReduction,
              ].map((benefit, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-2 bg-white/5 p-2 rounded-xl border border-white/10"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
                  <span className="leading-snug">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Mobile Map View Modal */}
      <AnimatePresence>
        {isFullscreenSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#102A2E]/80 backdrop-blur-md flex flex-col justify-end"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md mx-auto h-[92vh] bg-white rounded-t-3xl border-t border-[#DCE6E1] shadow-2xl flex flex-col overflow-hidden relative"
            >
              <div className="p-4 border-b border-[#DCE6E1] bg-[#F5F8F5] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-extrabold text-sm text-[#102A2E] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#087F5B]" />
                    <span>Dubai Mobility Interactive Map</span>
                  </h3>
                  {origin && destination && (
                    <p className="text-xs text-[#607276] font-medium mt-0.5">
                      {isRtl ? origin.nameAr : origin.nameEn} → {isRtl ? destination.nameAr : destination.nameEn}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsFullscreenSheet(false)}
                  className="p-2 min-h-[36px] min-w-[36px] rounded-2xl bg-white border border-[#DCE6E1] text-[#607276] hover:text-[#102A2E] shadow-2xs flex items-center justify-center"
                  aria-label={t.close}
                >
                  <Minimize2 className="w-4 h-4 text-[#087F5B]" />
                </button>
              </div>

              <div className="flex-1 relative bg-[#EAF3EE]">
                <MobilityCanvas
                  origin={
                    origin || {
                      id: 'dubai-internet-city',
                      nameEn: 'Dubai Internet City',
                      nameAr: 'مدينة دبي للإنترنت',
                      zone: '1',
                      metroStation: 'DIC',
                      lat: 25.09,
                      lng: 55.15,
                      category: 'hub',
                      districtEn: 'DIC',
                      districtAr: 'DIC',
                      accessibilityInfoEn: '',
                      accessibilityInfoAr: '',
                      nearbyModes: ['metro'],
                    }
                  }
                  destination={
                    destination || {
                      id: 'dubai-mall',
                      nameEn: 'Dubai Mall',
                      nameAr: 'دبي مول',
                      zone: '1',
                      metroStation: 'Burj Khalifa',
                      lat: 25.20,
                      lng: 55.27,
                      category: 'retail',
                      districtEn: 'Downtown',
                      districtAr: 'وسط المدينة',
                      accessibilityInfoEn: '',
                      accessibilityInfoAr: '',
                      nearbyModes: ['metro'],
                    }
                  }
                  activeMobilityNeed={prefs.reducedWalking ? 'reduced-walking' : 'standard'}
                  isEvaluating={isAnalyzing}
                  language={prefs.language}
                />

                <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                  <button
                    type="button"
                    onClick={handleRecentre}
                    className="p-2.5 min-h-[44px] rounded-2xl bg-white text-[#102A2E] border border-[#DCE6E1] shadow-md text-xs font-bold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4 text-[#087F5B]" />
                    <span>{t.mapRecentre}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

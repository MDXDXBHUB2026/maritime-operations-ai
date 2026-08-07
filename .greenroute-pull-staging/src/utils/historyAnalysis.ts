import { SelectedJourneyLog, LocationItem, LocationId } from '../types';
import { LOCATIONS } from '../data/mockData';

export interface FavoriteDestination {
  location: LocationItem;
  count: number;
  isTopCommon: boolean;
  lastVisitedAt?: string;
}

/**
 * Analyzes historical trip logs to extract the most common/frequent destinations.
 * Blends actual trip frequency with sensible defaults for brand new users.
 */
export function analyzeFavoriteDestinations(
  logs: SelectedJourneyLog[],
  limit: number = 4
): FavoriteDestination[] {
  const countsMap: Record<string, { count: number; lastVisitedAt?: string }> = {};

  // Process user's trip history logs
  if (Array.isArray(logs) && logs.length > 0) {
    logs.forEach((log) => {
      if (!log.destinationId) return;
      const destId = log.destinationId;
      if (!countsMap[destId]) {
        countsMap[destId] = { count: 0, lastVisitedAt: log.selectedAt };
      }
      countsMap[destId].count += 1;
      if (
        log.selectedAt &&
        (!countsMap[destId].lastVisitedAt || log.selectedAt > countsMap[destId].lastVisitedAt!)
      ) {
        countsMap[destId].lastVisitedAt = log.selectedAt;
      }
    });
  }

  // Ensure default popular hubs are available if user has limited logs
  const defaultFallbacks: { id: LocationId; defaultCount: number }[] = [
    { id: 'dubai-mall', defaultCount: 4 },
    { id: 'difc', defaultCount: 2 },
    { id: 'deira-city-centre', defaultCount: 2 },
    { id: 'business-bay', defaultCount: 1 },
    { id: 'jumeirah-lakes-towers', defaultCount: 1 },
  ];

  defaultFallbacks.forEach((item) => {
    if (!countsMap[item.id]) {
      countsMap[item.id] = { count: item.defaultCount };
    }
  });

  const result: FavoriteDestination[] = [];

  Object.entries(countsMap).forEach(([destId, data]) => {
    const loc = LOCATIONS.find((l) => l.id === destId);
    if (loc) {
      result.push({
        location: loc,
        count: data.count,
        isTopCommon: false,
        lastVisitedAt: data.lastVisitedAt,
      });
    }
  });

  // Sort by count descending, then by last visited date
  result.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    if (a.lastVisitedAt && b.lastVisitedAt) {
      return new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime();
    }
    return 0;
  });

  // Mark the #1 most common destination
  if (result.length > 0) {
    result[0].isTopCommon = true;
  }

  return result.slice(0, limit);
}


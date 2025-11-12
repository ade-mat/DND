import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useGame } from '@/context/GameContext';
import type { SceneNode, WorldMapLocation } from '@/types';

type WorldMapVariant = 'full' | 'sidebar';

interface WorldMapProps {
  variant?: WorldMapVariant;
}

const tierLabels: Record<NonNullable<WorldMapLocation['tier']> | 'city', string> = {
  city: 'City District',
  approach: 'Approach Route',
  spire: 'Spire Interior',
  heart: 'Heart Threshold'
};

const buildSceneTitleLookup = (scenes: SceneNode[]) => {
  const lookup = new Map<string, string>();
  scenes.forEach((scene) => {
    lookup.set(scene.id, scene.title);
  });
  return lookup;
};

const WorldMap = ({ variant = 'full' }: WorldMapProps) => {
  const { campaign, currentSceneId, visitedScenes } = useGame();
  const mapConfig = campaign.map;
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);

  const panelClass = clsx(
    'world-map-panel',
    variant === 'sidebar' && 'world-map-panel--compact'
  );

  const { locationById, sceneToLocation } = useMemo(() => {
    if (!mapConfig) {
      return {
        locationById: new Map<string, WorldMapLocation>(),
        sceneToLocation: new Map<string, string>()
      };
    }
    const locationIndex = new Map<string, WorldMapLocation>();
    const sceneIndex = new Map<string, string>();
    mapConfig.locations.forEach((location) => {
      locationIndex.set(location.id, location);
      location.sceneIds.forEach((sceneId) => {
        sceneIndex.set(sceneId, location.id);
      });
    });
    return { locationById: locationIndex, sceneToLocation: sceneIndex };
  }, [mapConfig]);

  if (!mapConfig || mapConfig.locations.length === 0) {
    return (
      <section className={panelClass}>
        <header className="world-map__header">
          <div>
            <h3>World Map</h3>
            <p className="muted">This campaign does not define any mappable locations.</p>
          </div>
        </header>
      </section>
    );
  }

  const sceneTitleLookup = useMemo(
    () => buildSceneTitleLookup(campaign.scenes),
    [campaign.scenes]
  );

  const visitedLocationIds = useMemo(() => {
    const visited = new Set<string>();
    mapConfig.locations.forEach((location) => {
      const hasVisited = location.sceneIds.some(
        (sceneId) => (visitedScenes[sceneId] ?? 0) > 0
      );
      if (hasVisited) {
        visited.add(location.id);
      }
    });
    return visited;
  }, [mapConfig.locations, visitedScenes]);

  const connectionSegments = useMemo(() => {
    const segments: Array<{
      id: string;
      from: WorldMapLocation;
      to: WorldMapLocation;
      visited: boolean;
    }> = [];
    const seen = new Set<string>();

    mapConfig.locations.forEach((location) => {
      location.connections?.forEach((targetId) => {
        const target = locationById.get(targetId);
        if (!target) {
          return;
        }
        const key =
          location.id < target.id
            ? `${location.id}-${target.id}`
            : `${target.id}-${location.id}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        segments.push({
          id: key,
          from: location,
          to: target,
          visited:
            visitedLocationIds.has(location.id) &&
            visitedLocationIds.has(target.id)
        });
      });
    });

    return segments;
  }, [locationById, mapConfig.locations, visitedLocationIds]);

  const resolveLocation = (locationId: string | null) =>
    locationId ? locationById.get(locationId) ?? null : null;

  const currentLocationId =
    (currentSceneId ? sceneToLocation.get(currentSceneId) : null) ??
    (currentSceneId
      ? campaign.scenes.find((scene) => scene.id === currentSceneId)?.locationId ??
        null
      : null);

  const detailLocation =
    resolveLocation(focusedLocationId) ??
    resolveLocation(currentLocationId) ??
    mapConfig.locations[0] ??
    null;

  const detailSceneTitles =
    detailLocation?.sceneIds
      .map((sceneId) => sceneTitleLookup.get(sceneId))
      .filter(Boolean) ?? [];

  const visitedLocations = mapConfig.locations.filter((location) =>
    visitedLocationIds.has(location.id)
  );

  const upcomingLocations = mapConfig.locations
    .filter((location) => !visitedLocationIds.has(location.id))
    .slice(0, variant === 'sidebar' ? 2 : 4);

  const progressLabel = `${visitedLocations.length}/${mapConfig.locations.length}`;

  return (
    <section className={panelClass}>
      <header className="world-map__header">
        <div>
          <h3>Emberfall Atlas</h3>
          {variant === 'full' && mapConfig.description ? (
            <p className="muted">{mapConfig.description}</p>
          ) : (
            <p className="muted">Track the path you have charted through Emberfall.</p>
          )}
        </div>
        <div className="world-map__progress">
          <span>Visited</span>
          <strong>{progressLabel}</strong>
        </div>
      </header>

      <div className="world-map__legend">
        <span>
          <span className="legend-dot current" />
          Current
        </span>
        <span>
          <span className="legend-dot visited" />
          Visited
        </span>
        <span>
          <span className="legend-dot future" />
          Unvisited
        </span>
      </div>

      <div className="world-map__canvas" role="presentation" aria-hidden="true">
        <svg
          className="world-map__connections"
          viewBox={`0 0 ${mapConfig.width} ${mapConfig.height}`}
          preserveAspectRatio="none"
        >
          {connectionSegments.map((segment) => (
            <line
              key={segment.id}
              x1={segment.from.position.x}
              y1={segment.from.position.y}
              x2={segment.to.position.x}
              y2={segment.to.position.y}
              className={clsx(
                'world-map__segment',
                segment.visited && 'world-map__segment--visited'
              )}
            />
          ))}
        </svg>
        {mapConfig.locations.map((location) => {
          const visited = visitedLocationIds.has(location.id);
          const isCurrent = currentLocationId === location.id;
          const nodeClass = clsx(
            'world-map__node',
            visited && 'visited',
            isCurrent && 'current'
          );
          const left = (location.position.x / mapConfig.width) * 100;
          const top = (location.position.y / mapConfig.height) * 100;
          return (
            <button
              key={location.id}
              type="button"
              className={nodeClass}
              style={{ left: `${left}%`, top: `${top}%` }}
              onMouseEnter={() => setFocusedLocationId(location.id)}
              onMouseLeave={() => setFocusedLocationId(null)}
              onFocus={() => setFocusedLocationId(location.id)}
              onBlur={() => setFocusedLocationId(null)}
            >
              <span className="world-map__node-dot" />
              <span className="world-map__node-label">{location.name}</span>
            </button>
          );
        })}
      </div>

      {detailLocation && (
        <div className="world-map__details">
          <div>
            <h4>{detailLocation.name}</h4>
            <p>{detailLocation.summary}</p>
          </div>
          <div className="world-map__detail-meta">
            <span className="world-map__tier-chip">
              {tierLabels[detailLocation.tier ?? 'city']}
            </span>
            <div className="world-map__detail-status">
              <span
                className={clsx(
                  'world-map__badge',
                  visitedLocationIds.has(detailLocation.id) && 'visited',
                  currentLocationId === detailLocation.id && 'current'
                )}
              >
                {currentLocationId === detailLocation.id
                  ? 'Active Objective'
                  : visitedLocationIds.has(detailLocation.id)
                    ? 'Visited'
                    : 'Locked'}
              </span>
            </div>
          </div>
          {detailSceneTitles.length > 0 && (
            <p className="world-map__scene-list">
              Scenes: {detailSceneTitles.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="world-map__status">
        <div>
          <h5>Visited Landmarks</h5>
          <ul>
            {visitedLocations.length === 0 ? (
              <li className="muted">No locations explored yet.</li>
            ) : (
              visitedLocations.map((location) => (
                <li key={location.id}>{location.name}</li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h5>On the Horizon</h5>
          <ul>
            {upcomingLocations.length === 0 ? (
              <li className="muted">All locations cleared.</li>
            ) : (
              upcomingLocations.map((location) => (
                <li key={location.id}>{location.name}</li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default WorldMap;

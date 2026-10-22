import { useEffect, useMemo, useState } from "react";
import { Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";

export interface RouteGeometry {
    type?: string;
    coordinates?: [number, number][]; // [lon, lat] from GeoJSON
}

export interface RouteData {
    geometry: [number, number][] | RouteGeometry;
    distance_km?: number | string;
    duration_min?: number;
    distance: number; // meters
    duration: number; // seconds
    label?: string;
    weight?: number;
    weight_name?: string;
    legs?: any[];
    aqiSummary?: {
        averageAqi: number;
        maxAqi: number;
        category: string;
        exposureScore: number;
        waypointSamples: Array<{
            lat: number;
            lon: number;
            aqi: number;
        }>;
    };
}

interface RouteLayerProps {
    routeData: RouteData[];
    selectedRouteIndex?: number;
    onSelectRoute?: (index: number) => void;
}

// Color schemes: Main Route (#22c55e), Alternate 1 (#3b82f6), Alternate 2 (#f97316)
interface RoutePalette {
    color: string;
    casingColor: string;
    haloColor: string;
    badgeBg: string;
    name: string;
    weight: number;
}

const PALETTES: RoutePalette[] = [
    {
        color: "#22c55e", // Green
        casingColor: "#14532d",
        haloColor: "rgba(34, 197, 94, 0.35)",
        badgeBg: "#16a34a",
        name: "Main Route",
        weight: 6,
    },
    {
        color: "#3b82f6", // Blue
        casingColor: "#1e3a8a",
        haloColor: "rgba(59, 130, 246, 0.35)",
        badgeBg: "#2563eb",
        name: "Alternate 1",
        weight: 4,
    },
    {
        color: "#f97316", // Orange
        casingColor: "#7c2d12",
        haloColor: "rgba(249, 115, 22, 0.35)",
        badgeBg: "#ea580c",
        name: "Alternate 2",
        weight: 4,
    },
];

function getPalette(index: number): RoutePalette {
    if (index < PALETTES.length) return PALETTES[index];
    const fallbackColors = ["#8b5cf6", "#ec4899", "#14b8a6"];
    const col = fallbackColors[(index - PALETTES.length) % fallbackColors.length];
    return {
        color: col,
        casingColor: "#312e81",
        haloColor: "rgba(139, 92, 246, 0.35)",
        badgeBg: col,
        name: `Alternate ${index}`,
        weight: 4,
    };
}

// Automatically fit map bounds when a new route is received
function AutoFitBounds({ positions }: { positions: [number, number][] }) {
    const map = useMap();

    useEffect(() => {
        if (positions.length > 0) {
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
        }
    }, [positions, map]);

    return null;
}

// Convert arbitrary geometry shape into [lat, lon][]
function parseLatLngs(geometry: RouteData["geometry"]): [number, number][] {
    if (Array.isArray(geometry)) {
        return geometry;
    }
    return geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) ?? [];
}

// Check if two coordinate arrays overlap heavily (same path)
function areGeometriesOverlapping(geomA: [number, number][], geomB: [number, number][]): boolean {
    if (geomA.length === 0 || geomB.length === 0) return false;
    const lenA = geomA.length;
    const lenB = geomB.length;
    // Check 5 sample points across the geometry
    const checkIndices = [
        0,
        Math.floor(lenA * 0.25),
        Math.floor(lenA * 0.5),
        Math.floor(lenA * 0.75),
        lenA - 1,
    ];
    let matchingCount = 0;
    for (const idx of checkIndices) {
        const pA = geomA[idx];
        const matchIdx = Math.floor((idx / lenA) * lenB);
        const pB = geomB[matchIdx];
        if (pA && pB && Math.abs(pA[0] - pB[0]) < 0.0003 && Math.abs(pA[1] - pB[1]) < 0.0003) {
            matchingCount++;
        }
    }
    return matchingCount >= 3;
}

/**
 * Calculates a parallel offset in meters for a polyline so that overlapping routes
 * remain side-by-side and clearly distinguishable on the map.
 */
function applyParallelOffset(points: [number, number][], offsetMeters: number): [number, number][] {
    if (offsetMeters === 0 || points.length < 2) return points;

    const metersPerDegreeLat = 111320;
    const offsetPoints: [number, number][] = [];

    for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const prev = i > 0 ? points[i - 1] : points[i];
        const next = i < points.length - 1 ? points[i + 1] : points[i];

        const dLat = next[0] - prev[0];
        const dLon = next[1] - prev[1];

        const metersPerDegreeLon = 111320 * Math.cos((curr[0] * Math.PI) / 180);
        const dx = dLon * metersPerDegreeLon;
        const dy = dLat * metersPerDegreeLat;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) {
            offsetPoints.push([curr[0], curr[1]]);
            continue;
        }

        // Perpendicular normal vector
        const nx = -dy / len;
        const ny = dx / len;

        const offsetLat = (ny * offsetMeters) / metersPerDegreeLat;
        const offsetLon = (nx * offsetMeters) / metersPerDegreeLon;

        offsetPoints.push([curr[0] + offsetLat, curr[1] + offsetLon]);
    }

    return offsetPoints;
}

// Single AQI pill icon creator per route
function createRouteAqiPillIcon(
    aqi: number,
    routeLabel: string,
    palette: RoutePalette,
    isSelected: boolean,
    isHovered: boolean
) {
    const isProminent = isSelected || isHovered;
    const shadow = isProminent
        ? `0 6px 16px ${palette.haloColor}, 0 2px 8px rgba(0,0,0,0.35)`
        : `0 3px 10px rgba(0,0,0,0.25)`;
    const border = isProminent ? "2px solid #ffffff" : "1.5px solid rgba(255,255,255,0.9)";
    const scale = isProminent ? "1.08" : "1.0";

    return L.divIcon({
        className: "route-aqi-pill-marker",
        html: `
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: ${palette.color};
                color: #ffffff;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 800;
                font-size: 11.5px;
                letter-spacing: -0.01em;
                padding: 4px 10px;
                border-radius: 9999px;
                border: ${border};
                box-shadow: ${shadow};
                transform: scale(${scale});
                transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease;
                white-space: nowrap;
                cursor: pointer;
                user-select: none;
            ">
                <span style="opacity: 0.9; font-weight: 600; font-size: 10px; text-transform: uppercase;">${routeLabel}</span>
                <span style="width: 3px; height: 3px; border-radius: 50%; background: white; opacity: 0.6;"></span>
                <span>AQI ${aqi}</span>
            </div>
        `,
        iconSize: [110, 26],
        iconAnchor: [55, 13],
    });
}

export function RouteLayer({
    routeData,
    selectedRouteIndex: controlledIndex,
    onSelectRoute,
}: RouteLayerProps) {
    const [internalSelectedIndex, setInternalSelectedIndex] = useState<number>(0);
    const [hoveredRouteIndex, setHoveredRouteIndex] = useState<number | null>(null);

    const activeIndexRaw = controlledIndex !== undefined ? controlledIndex : internalSelectedIndex;
    const activeIndex =
        activeIndexRaw >= 0 && activeIndexRaw < routeData.length ? activeIndexRaw : 0;

    const handleSelect = (idx: number) => {
        setInternalSelectedIndex(idx);
        onSelectRoute?.(idx);
    };

    // Parse coordinates for each route
    const rawRoutes = useMemo(() => {
        return routeData.map((route, index) => {
            const rawPoints = parseLatLngs(route.geometry);
            return {
                index,
                route,
                rawPoints,
            };
        });
    }, [routeData]);

    // Apply parallel offset if routes overlap or have identical path segments
    const renderedRoutes = useMemo(() => {
        return rawRoutes.map(({ index, route, rawPoints }) => {
            if (rawPoints.length === 0) {
                return { index, route, displayPoints: [], midpoint: null, aqi: null };
            }

            // Count prior overlapping routes
            let overlapCount = 0;
            for (let j = 0; j < index; j++) {
                if (areGeometriesOverlapping(rawPoints, rawRoutes[j].rawPoints)) {
                    overlapCount++;
                }
            }

            // Alternate lateral offset: 0, +10m, -10m, +20m
            let offsetMeters = 0;
            if (overlapCount > 0) {
                const sign = overlapCount % 2 === 1 ? 1 : -1;
                const magnitude = Math.ceil(overlapCount / 2) * 10;
                offsetMeters = sign * magnitude;
            }

            const displayPoints =
                offsetMeters !== 0 ? applyParallelOffset(rawPoints, offsetMeters) : rawPoints;

            // Compute midpoint for exactly ONE AQI label per route
            const midIndex = Math.floor(displayPoints.length / 2);
            const midpoint = displayPoints[midIndex] ?? null;

            const aqi =
                route.aqiSummary?.averageAqi !== undefined
                    ? route.aqiSummary.averageAqi
                    : null;

            return {
                index,
                route,
                displayPoints,
                midpoint,
                aqi,
            };
        });
    }, [rawRoutes]);

    // Resolve vertical collision between AQI pill labels if placed within 35px
    const aqiLabels = useMemo(() => {
        const labels: Array<{
            index: number;
            latLng: [number, number];
            aqi: number;
        }> = [];

        // Threshold in degrees (~35px at typical zoom level)
        const THRESHOLD = 0.00035;
        const SHIFT = 0.00045;

        renderedRoutes.forEach(({ index, midpoint, aqi }) => {
            if (!midpoint || aqi === null) return;
            let [lat, lon] = midpoint;

            // Check against placed labels
            for (const placed of labels) {
                const dLat = Math.abs(placed.latLng[0] - lat);
                const dLon = Math.abs(placed.latLng[1] - lon);
                if (dLat < THRESHOLD && dLon < THRESHOLD) {
                    lat += SHIFT; // Offset vertically to avoid stacking
                }
            }

            labels.push({
                index,
                latLng: [lat, lon],
                aqi,
            });
        });

        return labels;
    }, [renderedRoutes]);

    if (!routeData || routeData.length === 0) {
        return null;
    }

    const firstRoutePoints = renderedRoutes[0]?.displayPoints ?? [];
    const originPoint = firstRoutePoints[0];
    const destinationPoint = firstRoutePoints[firstRoutePoints.length - 1];

    // Layer ordering: unselected routes on bottom, hovered on middle, selected on very top
    const sortedRenderIndices = [...renderedRoutes.keys()].sort((a, b) => {
        if (a === activeIndex) return 1;
        if (b === activeIndex) return -1;
        if (a === hoveredRouteIndex) return 1;
        if (b === hoveredRouteIndex) return -1;
        return a - b;
    });

    return (
        <>
            {/* Auto-fit map viewport to primary route */}
            {firstRoutePoints.length > 0 && <AutoFitBounds positions={firstRoutePoints} />}

            {/* RENDER ALL ROUTES SIMULTANEOUSLY */}
            {sortedRenderIndices.map((i) => {
                const item = renderedRoutes[i];
                if (!item || item.displayPoints.length === 0) return null;

                const { index, displayPoints } = item;
                const palette = getPalette(index);
                const isSelected = index === activeIndex;
                const isHovered = index === hoveredRouteIndex;

                // Requirements:
                // Main route weight = 6px, alternates = 4px
                // Non-selected routes opacity = 0.6, selected/hovered = 1.0
                const baseWeight = palette.weight;
                const activeWeight = isHovered ? baseWeight + 2 : baseWeight;
                const lineOpacity = isSelected || isHovered ? 1.0 : 0.6;

                return (
                    <div key={`route-poly-${index}`}>
                        {/* WIDE INVISIBLE CLICK & HOVER AREA (28px) */}
                        <Polyline
                            positions={displayPoints}
                            eventHandlers={{
                                click: () => handleSelect(index),
                                mouseover: () => setHoveredRouteIndex(index),
                                mouseout: () => {
                                    setHoveredRouteIndex((prev) => (prev === index ? null : prev));
                                },
                            }}
                            pathOptions={{
                                color: "transparent",
                                weight: 28,
                                opacity: 0.001,
                                lineCap: "round",
                                lineJoin: "round",
                            }}
                        />

                        {/* Subtle casing/border for premium depth & contrast on any map tile */}
                        <Polyline
                            positions={displayPoints}
                            pathOptions={{
                                color: "#ffffff",
                                weight: activeWeight + 3,
                                opacity: isSelected ? 0.9 : 0.4,
                                lineCap: "round",
                                lineJoin: "round",
                            }}
                        />

                        {/* Glowing halo for selected or hovered route */}
                        {(isSelected || isHovered) && (
                            <Polyline
                                positions={displayPoints}
                                pathOptions={{
                                    color: palette.color,
                                    weight: activeWeight + 6,
                                    opacity: 0.28,
                                    lineCap: "round",
                                    lineJoin: "round",
                                }}
                            />
                        )}

                        {/* Main solid colored route line */}
                        <Polyline
                            positions={displayPoints}
                            eventHandlers={{
                                click: () => handleSelect(index),
                                mouseover: () => setHoveredRouteIndex(index),
                                mouseout: () => {
                                    setHoveredRouteIndex((prev) => (prev === index ? null : prev));
                                },
                            }}
                            pathOptions={{
                                color: palette.color,
                                weight: activeWeight,
                                opacity: lineOpacity,
                                lineCap: "round",
                                lineJoin: "round",
                            }}
                        />
                    </div>
                );
            })}

            {/* 6 SAMPLED AQI WAYPOINT LOCATION PINS ALONG THE SELECTED ROUTE */}
            {(() => {
                const activeRoute = routeData[activeIndex];
                const samples = activeRoute?.aqiSummary?.waypointSamples;
                const palette = getPalette(activeIndex);

                if (!samples || samples.length === 0) return null;

                return samples.map((sample, sIdx) => {
                    return (
                        <Marker
                            key={`waypoint-pin-${activeIndex}-${sIdx}`}
                            position={[sample.lat, sample.lon]}
                            zIndexOffset={700}
                            icon={L.divIcon({
                                className: "waypoint-location-pin",
                                html: `
                                    <div style="
                                        display: flex;
                                        flex-direction: column;
                                        align-items: center;
                                        cursor: pointer;
                                        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
                                        transition: transform 0.15s ease;
                                    " title="Location Point #${sIdx + 1}: AQI ${sample.aqi}">
                                        <div style="
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            background: ${palette.color};
                                            color: #ffffff;
                                            font-family: system-ui, sans-serif;
                                            font-size: 11px;
                                            font-weight: 800;
                                            min-width: 28px;
                                            height: 22px;
                                            padding: 0 5px;
                                            border-radius: 9999px;
                                            border: 2px solid #ffffff;
                                        ">
                                            ${sample.aqi}
                                        </div>
                                        <div style="
                                            width: 0;
                                            height: 0;
                                            border-left: 5px solid transparent;
                                            border-right: 5px solid transparent;
                                            border-top: 6px solid ${palette.color};
                                            margin-top: -1px;
                                        "></div>
                                    </div>
                                `,
                                iconSize: [36, 28],
                                iconAnchor: [18, 27],
                            })}
                        />
                    );
                });
            })()}

            {/* OVERALL AQI BADGE SHOWN FOR SELECTED OR HOVERED ROUTE */}
            {aqiLabels.map(({ index, latLng, aqi }) => {
                const isSelected = index === activeIndex;
                const isHovered = index === hoveredRouteIndex;

                // Show overall AQI badge only when route is selected or hovered
                if (!isSelected && !isHovered) return null;

                const palette = getPalette(index);
                const labelName = index === 0 ? "Main" : `Alt ${index}`;

                const pillIcon = createRouteAqiPillIcon(
                    aqi,
                    labelName,
                    palette,
                    isSelected,
                    isHovered
                );

                return (
                    <Marker
                        key={`aqi-single-label-${index}`}
                        position={latLng}
                        icon={pillIcon}
                        zIndexOffset={isSelected ? 1000 : 800}
                        eventHandlers={{
                            click: () => handleSelect(index),
                            mouseover: () => setHoveredRouteIndex(index),
                            mouseout: () => {
                                setHoveredRouteIndex((prev) => (prev === index ? null : prev));
                            },
                        }}
                    />
                );
            })}

            {/* Origin Pin */}
            {originPoint && (
                <Marker
                    position={originPoint}
                    zIndexOffset={1200}
                    icon={L.divIcon({
                        className: "origin-marker",
                        html: `
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                width: 22px;
                                height: 22px;
                                background: #22c55e;
                                border: 3px solid #ffffff;
                                border-radius: 50%;
                                box-shadow: 0 3px 8px rgba(0,0,0,0.35);
                            ">
                                <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
                            </div>
                        `,
                        iconSize: [22, 22],
                        iconAnchor: [11, 11],
                    })}
                />
            )}

            {/* Destination Pin */}
            {destinationPoint && (
                <Marker
                    position={destinationPoint}
                    zIndexOffset={1200}
                    icon={L.divIcon({
                        className: "destination-marker",
                        html: `
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                width: 22px;
                                height: 22px;
                                background: #ef4444;
                                border: 3px solid #ffffff;
                                border-radius: 50%;
                                box-shadow: 0 3px 8px rgba(0,0,0,0.35);
                            ">
                                <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
                            </div>
                        `,
                        iconSize: [22, 22],
                        iconAnchor: [11, 11],
                    })}
                />
            )}
        </>
    );
}

export default RouteLayer;



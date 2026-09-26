import "dotenv/config";
import polyline from "@mapbox/polyline";

export type Coordinate = [number, number]; // [lat, lon]

export interface FormattedRoute {
    label: string; // e.g. "Main Route" | "Alternate 1" or "Fastest" | "Highway-free" | "Back roads"
    geometry: Coordinate[]; // [lat, lon][] decoded from polyline for Leaflet
    distance_km: string; // toFixed(1)
    duration_min: number; // rounded minutes
    distance: number; // raw meters
    duration: number; // seconds
}

interface ValhallaResponse {
    trip?: {
        locations?: Array<{
            lat: number;
            lon: number;
        }>;
        legs?: Array<{
            shape?: string;
            summary?: {
                length?: number; // km
                time?: number; // seconds
            };
        }>;
        summary?: {
            length?: number;
            time?: number;
        };
        status?: number;
        status_message?: string;
    };
    alternates?: Array<{
        trip: {
            locations?: Array<{
                lat: number;
                lon: number;
            }>;
            legs?: Array<{
                shape?: string;
                summary?: {
                    length?: number;
                    time?: number;
                };
            }>;
            summary?: {
                length?: number;
                time?: number;
            };
            status?: number;
            status_message?: string;
        };
    }>;
    error_code?: number;
    error?: string;
}

interface RouteConfig {
    label: string;
    costing: string;
    costing_options?: Record<string, unknown>;
    directions_options: {
        units: "km";
    };
}

const STADIA_API_URL = "https://api.stadiamaps.com/route/v1";
const DEFAULT_TIMEOUT_MS = 10000;

const FALLBACK_CONFIGS: RouteConfig[] = [
    {
        label: "Fastest",
        costing: "auto",
        directions_options: { units: "km" },
    },
    {
        label: "Highway-free",
        costing: "auto",
        costing_options: {
            auto: {
                use_highways: 0.0,
                use_tolls: 0.0,
            },
        },
        directions_options: { units: "km" },
    },
    {
        label: "Back roads",
        costing: "auto",
        costing_options: {
            auto: {
                use_highways: 0.0,
                use_tolls: 0.0,
                shortest: true,
            },
        },
        directions_options: { units: "km" },
    },
];

/**
 * Fetches a single route configuration from Stadia Maps Valhalla API.
 */
async function fetchStadiaRoute(
    origin: Coordinate,
    destination: Coordinate,
    config: RouteConfig,
    signal?: AbortSignal
): Promise<FormattedRoute> {
    const apiKey = process.env.STADIA_API_KEY;
    if (!apiKey) {
        throw new Error("STADIA_API_KEY is not set in environment variables");
    }

    const requestBody: Record<string, unknown> = {
        locations: [
            { lon: origin[1], lat: origin[0] },
            { lon: destination[1], lat: destination[0] },
        ],
        costing: config.costing,
        directions_options: config.directions_options,
    };

    if (config.costing_options) {
        requestBody.costing_options = config.costing_options;
    }

    const response = await fetch(`${STADIA_API_URL}?api_key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: signal ?? null,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
    }

    const data = (await response.json()) as ValhallaResponse;
    const leg = data.trip?.legs?.[0];

    if (!leg || !leg.shape || !leg.summary) {
        throw new Error("Invalid response from Stadia Maps: missing trip leg, shape, or summary");
    }

    const lengthKm = leg.summary.length ?? 0;
    const timeSec = leg.summary.time ?? 0;
    const geometry = polyline.decode(leg.shape, 6) as Coordinate[];

    return {
        label: config.label,
        geometry,
        distance_km: lengthKm.toFixed(1),
        duration_min: Math.round(timeSec / 60),
        distance: Math.round(lengthKm * 1000),
        duration: Math.round(timeSec),
    };
}

function isSameGeometry(geomA: Coordinate[], geomB: Coordinate[]): boolean {
    if (geomA.length !== geomB.length) return false;
    for (let i = 0; i < geomA.length; i++) {
        const [latA, lonA] = geomA[i]!;
        const [latB, lonB] = geomB[i]!;
        if (Math.abs(latA - latB) > 1e-6 || Math.abs(lonA - lonB) > 1e-6) {
            return false;
        }
    }
    return true;
}

function formatRouteFromLeg(
    label: string,
    leg?: {
        shape?: string;
        summary?: { length?: number; time?: number };
    }
): FormattedRoute | null {
    if (!leg?.shape || !leg?.summary) return null;
    const lengthKm = leg.summary.length ?? 0;
    const timeSec = leg.summary.time ?? 0;
    const geometry = polyline.decode(leg.shape, 6) as Coordinate[];

    return {
        label,
        geometry,
        distance_km: lengthKm.toFixed(1),
        duration_min: Math.round(timeSec / 60),
        distance: Math.round(lengthKm * 1000),
        duration: Math.round(timeSec),
    };
}

/**
 * Fallback approach: Fetches multiple distinct routes using different costing options
 * (Fastest, Highway-free, Back roads) via parallel Promise.allSettled calls.
 */
async function fetchFallbackDistinctRoutes(
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal
): Promise<FormattedRoute[]> {
    console.log("[routeService] Falling back to multi-profile costing options (Fastest, Highway-free, Back roads)...");
    const fallbackSignal = signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
    const results = await Promise.allSettled(
        FALLBACK_CONFIGS.map((config) => fetchStadiaRoute(origin, destination, config, fallbackSignal))
    );

    const successfulRoutes: FormattedRoute[] = [];
    results.forEach((res, index) => {
        const label = FALLBACK_CONFIGS[index]?.label ?? `Route ${index + 1}`;
        if (res.status === "fulfilled") {
            const route = res.value;
            const isDuplicate = successfulRoutes.some((existing) =>
                isSameGeometry(existing.geometry, route.geometry)
            );
            if (!isDuplicate) {
                successfulRoutes.push(route);
            } else {
                console.log(`[routeService] Skipping fallback route "${label}" because its geometry is identical to an existing route.`);
            }
        } else {
            console.error(`Fallback call failed for "${label}":`, res.reason);
        }
    });

    if (successfulRoutes.length === 0) {
        throw new Error("All fallback route calls failed");
    }

    return successfulRoutes;
}

/**
 * Fetches routes using Stadia Maps / Valhalla native `alternates: 3` parameter.
 * If Valhalla returns alternatesCount === 0 (no alternates available),
 * it seamlessly falls back to the multi-profile costing approach (Fastest, Highway-free, Back roads).
 */
export async function getDistinctRoutes(
    origin: Coordinate,
    destination: Coordinate,
    alternatesCount: number = 3,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<FormattedRoute[]> {
    const apiKey = process.env.STADIA_API_KEY;
    if (!apiKey) {
        throw new Error("STADIA_API_KEY is not set in environment variables");
    }

    const signal = AbortSignal.timeout(timeoutMs);

    const requestBody: Record<string, unknown> = {
        locations: [
            { lon: origin[1], lat: origin[0] },
            { lon: destination[1], lat: destination[0] },
        ],
        costing: "auto",
        directions_options: { units: "km" },
        alternates: alternatesCount,
    };

    console.log("[routeService] Requesting routes with alternates:", alternatesCount, requestBody);

    const response = await fetch(`${STADIA_API_URL}?api_key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
    }

    const data = (await response.json()) as ValhallaResponse;
    const receivedAlternatesCount = data.alternates?.length ?? 0;
    console.log("[routeService] Response received:", {
        hasTrip: !!data.trip,
        alternatesCount: receivedAlternatesCount,
    });

    // Format the valid primary trip from the response if available
    const primaryRoute = formatRouteFromLeg("Main Route", data.trip?.legs?.[0]);

    // If alternates parameter produced 0 alternate routes, supplement with fallback routes
    if (receivedAlternatesCount === 0) {
        try {
            const fallbackRoutes = await fetchFallbackDistinctRoutes(origin, destination);
            if (primaryRoute) {
                // Keep primaryRoute first, then append only geometrically unique fallback routes
                const combinedRoutes: FormattedRoute[] = [primaryRoute];
                for (const fb of fallbackRoutes) {
                    if (!combinedRoutes.some((r) => isSameGeometry(r.geometry, fb.geometry))) {
                        combinedRoutes.push(fb);
                    }
                }
                return combinedRoutes;
            }
            return fallbackRoutes;
        } catch (fallbackError) {
            console.warn("[routeService] Fallback retrieval failed:", fallbackError);
            if (primaryRoute) {
                console.log("[routeService] Retaining valid primary route despite fallback failure.");
                return [primaryRoute];
            }
            throw fallbackError;
        }
    }

    const routes: FormattedRoute[] = [];

    // 1. Process main trip (Primary route)
    if (primaryRoute) {
        routes.push(primaryRoute);
    }

    // 2. Process alternate trips
    if (data.alternates && Array.isArray(data.alternates)) {
        data.alternates.forEach((alt, idx) => {
            const leg = alt.trip?.legs?.[0];
            if (leg?.shape && leg?.summary) {
                const lengthKm = leg.summary.length ?? 0;
                const timeSec = leg.summary.time ?? 0;
                const geometry = polyline.decode(leg.shape, 6) as Coordinate[];

                routes.push({
                    label: `Alternate ${idx + 1}`,
                    geometry,
                    distance_km: lengthKm.toFixed(1),
                    duration_min: Math.round(timeSec / 60),
                    distance: Math.round(lengthKm * 1000),
                    duration: Math.round(timeSec),
                });
            }
        });
    }

    if (routes.length === 0) {
        throw new Error("No valid routes found in Stadia Maps response");
    }

    return routes;
}

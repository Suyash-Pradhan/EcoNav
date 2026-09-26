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
    config: RouteConfig
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

/**
 * Fallback approach: Fetches multiple distinct routes using different costing options
 * (Fastest, Highway-free, Back roads) via parallel Promise.allSettled calls.
 */
async function fetchFallbackDistinctRoutes(
    origin: Coordinate,
    destination: Coordinate
): Promise<FormattedRoute[]> {
    console.log("[routeService] Falling back to multi-profile costing options (Fastest, Highway-free, Back roads)...");
    const results = await Promise.allSettled(
        FALLBACK_CONFIGS.map((config) => fetchStadiaRoute(origin, destination, config))
    );

    const successfulRoutes: FormattedRoute[] = [];
    results.forEach((res, index) => {
        const label = FALLBACK_CONFIGS[index]?.label ?? `Route ${index + 1}`;
        if (res.status === "fulfilled") {
            successfulRoutes.push(res.value);
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
    alternatesCount: number = 3
): Promise<FormattedRoute[]> {
    const apiKey = process.env.STADIA_API_KEY;
    if (!apiKey) {
        throw new Error("STADIA_API_KEY is not set in environment variables");
    }

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

    // fallback if alternates not found
    if (receivedAlternatesCount === 0) {
        return await fetchFallbackDistinctRoutes(origin, destination);
    }

    const routes: FormattedRoute[] = [];


    // 1. Process main trip (Primary route)
    const primaryLeg = data.trip?.legs?.[0];
    if (primaryLeg?.shape && primaryLeg?.summary) {
        const lengthKm = primaryLeg.summary.length ?? 0;
        const timeSec = primaryLeg.summary.time ?? 0;
        const geometry = polyline.decode(primaryLeg.shape, 6) as Coordinate[];

        routes.push({
            label: "Main Route",
            geometry,
            distance_km: lengthKm.toFixed(1),
            duration_min: Math.round(timeSec / 60),
            distance: Math.round(lengthKm * 1000),
            duration: Math.round(timeSec),
        });
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

import polyline from "@mapbox/polyline";
import type { Coordinate, FormattedRoute } from "../types/route.types.js";
import { DEFAULT_TIMEOUT_MS, FALLBACK_CONFIGS } from "../config/route.config.js";
import { isSameGeometry, formatRouteFromLeg } from "../utils/geoUtils.js";
import { fetchStadiaRoute, requestValhallaRoute } from "./stadiaClient.js";

// Re-export types for consumers
export type { Coordinate, FormattedRoute };

/**
 * Fallback approach: Fetches multiple distinct routes using different costing options
 * (Fastest, Highway-free, Back roads) via parallel Promise.allSettled calls.
 */
export async function fetchFallbackDistinctRoutes(
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
 * Fetches routes using Stadia Maps / Valhalla native `alternates` parameter.
 * If Valhalla returns alternatesCount === 0 (no alternates available),
 * it seamlessly falls back to the multi-profile costing approach (Fastest, Highway-free, Back roads).
 */
export async function getDistinctRoutes(
    origin: Coordinate,
    destination: Coordinate,
    alternatesCount: number = 3,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<FormattedRoute[]> {
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

    const data = await requestValhallaRoute(requestBody, signal);
    const receivedAlternatesCount = data.alternates?.length ?? 0;
    console.log("[routeService] Response received:", {
        hasTrip: !!data.trip,
        alternatesCount: receivedAlternatesCount,
    });

    // Format primary trip
    const primaryRoute = formatRouteFromLeg("Main Route", data.trip?.legs?.[0]);

    // If alternates produced 0 routes, supplement with fallback profile routes
    if (receivedAlternatesCount === 0) {
        try {
            const fallbackRoutes = await fetchFallbackDistinctRoutes(origin, destination);
            if (primaryRoute) {
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

    if (primaryRoute) {
        routes.push(primaryRoute);
    }

    // Process alternate trips
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

import polyline from "@mapbox/polyline";
import type { Coordinate, FormattedRoute, ValhallaTripLeg } from "../types/route.types.js";

/**
 * Checks if two geometries have identical points within a micro-degree tolerance.
 */
export function isSameGeometry(geomA: Coordinate[], geomB: Coordinate[]): boolean {
    if (geomA.length !== geomB.length) return false;
    for (let i = 0; i < geomA.length; i++) {
        const pA = geomA[i];
        const pB = geomB[i];
        if (!pA || !pB) return false;
        const [latA, lonA] = pA;
        const [latB, lonB] = pB;
        if (Math.abs(latA - latB) > 1e-6 || Math.abs(lonA - lonB) > 1e-6) {
            return false;
        }
    }
    return true;
}

/**
 * Decodes polyline shape and formats metrics from a Valhalla trip leg.
 */
export function formatRouteFromLeg(
    label: string,
    leg?: ValhallaTripLeg
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

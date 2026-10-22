import type { RouteAqiSummary } from "../types/aqi.types.js";
import { getCategoryLabel, sampleCoordinates } from "../utils/aqiUtils.js";
import { fetchAqi } from "./aqiService.js";
import type { FormattedRoute } from "./routeService.js";


export async function getRouteWithAqi(route: FormattedRoute): Promise<FormattedRoute & { aqiSummary: RouteAqiSummary }> {
    const waypoint = sampleCoordinates(route.geometry, 6);

    const aqiResults = await Promise.all(
        waypoint.map(async ([lat, lon]) => ({
            lat,
            lon,
            aqi: await fetchAqi(lat, lon)
        }))
    );

    const sumAqi = aqiResults.reduce((acc, curr) => acc + curr.aqi, 0);
    const avgAqi = aqiResults.length > 0 ? Math.round(sumAqi / aqiResults.length) : 0;
    const maxAqi = aqiResults.length > 0 ? Math.max(...aqiResults.map(r => r.aqi)) : 0;

    const durationMinutes = route.duration_min ?? Math.round(route.duration / 60);
    const trafficMultiplier = 1.0;
    const exposureScore = Math.round(avgAqi * durationMinutes * trafficMultiplier);

    return {
        ...route,
        aqiSummary: {
            averageAqi: avgAqi,
            maxAqi,
            category: getCategoryLabel(avgAqi),
            exposureScore,
            waypointSamples: aqiResults
        }
    };
}

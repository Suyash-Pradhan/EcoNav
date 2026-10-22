import type { RouteAqiSummary } from "../types/aqi.types.js";
import type { Coordinate } from "../types/route.types.js";

// EPA Breakpoint tables for PM2.5 (ug/m3 -> AQI 0-500)
export function calculatePM25AQI(pm25: number): number {
    if (pm25 <= 12.0) return linearScale(pm25, 0, 12, 0, 50);
    if (pm25 <= 35.4) return linearScale(pm25, 12.1, 35.4, 51, 100);
    if (pm25 <= 55.4) return linearScale(pm25, 35.5, 55.4, 101, 150);
    if (pm25 <= 150.4) return linearScale(pm25, 55.5, 150.4, 151, 200);
    if (pm25 <= 250.4) return linearScale(pm25, 150.5, 250.4, 201, 300);
    return linearScale(pm25, 250.5, 500, 301, 500);
}

function linearScale(val: number, cLow: number, cHigh: number, iLow: number, iHigh: number): number {
    return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (val - cLow) + iLow);
}

// Subsamples coordinates along route polyline (e.g. 5-7 points across the entire route)
export function sampleCoordinates(coords: Coordinate[], sampleCount: number = 6): Coordinate[] {
    if (coords.length <= sampleCount) return coords;
    const step = (coords.length - 1) / (sampleCount - 1);
    const samples: Coordinate[] = [];
    for (let i = 0; i < sampleCount; i++) {
        const pt = coords[Math.round(i * step)];
        if (pt) samples.push(pt);
    }
    return samples;
}

export function getCategoryLabel(aqi: number): RouteAqiSummary["category"] {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy for Sensitive Groups";
    if (aqi <= 200) return "Unhealthy";
    if (aqi <= 300) return "Very Unhealthy";
    return "Hazardous";
}

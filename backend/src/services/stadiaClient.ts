import "dotenv/config";
import type { Coordinate, FormattedRoute, RouteConfig, ValhallaResponse } from "../types/route.types.js";
import { STADIA_API_URL } from "../config/route.config.js";
import { formatRouteFromLeg } from "../utils/geoUtils.js";

function getApiKey(): string {
    const apiKey = process.env.STADIA_API_KEY;
    if (!apiKey) {
        throw new Error("STADIA_API_KEY is not set in environment variables");
    }
    return apiKey;
}

/**
 * Executes a raw route request to Stadia Maps Valhalla API.
 */
export async function requestValhallaRoute(
    requestBody: Record<string, unknown>,
    signal?: AbortSignal
): Promise<ValhallaResponse> {
    const apiKey = getApiKey();
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

    return (await response.json()) as ValhallaResponse;
}

/**
 * Fetches a single route configuration from Stadia Maps Valhalla API.
 */
export async function fetchStadiaRoute(
    origin: Coordinate,
    destination: Coordinate,
    config: RouteConfig,
    signal?: AbortSignal
): Promise<FormattedRoute> {
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

    const data = await requestValhallaRoute(requestBody, signal);
    const leg = data.trip?.legs?.[0];

    const route = formatRouteFromLeg(config.label, leg);
    if (!route) {
        throw new Error("Invalid response from Stadia Maps: missing trip leg, shape, or summary");
    }

    return route;
}

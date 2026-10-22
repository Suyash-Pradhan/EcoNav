import type { RouteConfig } from "../types/route.types.js";

export const STADIA_API_URL = "https://api.stadiamaps.com/route/v1";
export const DEFAULT_TIMEOUT_MS = 10000;

export const FALLBACK_CONFIGS: RouteConfig[] = [
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

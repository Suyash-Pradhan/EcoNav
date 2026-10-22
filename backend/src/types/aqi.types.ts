export interface OpenMeteoHourlyUnits {
    time: string;
    pm10: string;
    pm2_5: string;
}

export interface OpenMeteoHourlyData {
    time: string[];
    pm10: (number | null)[];
    pm2_5: (number | null)[];
}

export interface OpenMeteoResponse {
    latitude: number;
    longitude: number;
    hourly: OpenMeteoHourlyData;
}

export interface RouteAqiSummary {
    averageAqi: number;
    maxAqi: number;
    category: "Good" | "Moderate" | "Unhealthy for Sensitive Groups" | "Unhealthy" | "Very Unhealthy" | "Hazardous";
    // dominantPollutant: "PM2.5" | "PM10";
    exposureScore: number; // Duration x AQI x Traffic congestion penalty
    waypointSamples: Array<{
        lat: number;
        lon: number;
        aqi: number;
    }>;
}

export type Coordinate = [number, number]; // [lat, lon]

export interface FormattedRoute {
    label: string; // e.g. "Main Route" | "Alternate 1" or "Fastest" | "Highway-free" | "Back roads"
    geometry: Coordinate[]; // [lat, lon][] decoded from polyline for Leaflet
    distance_km: string; // toFixed(1)
    duration_min: number; // rounded minutes
    distance: number; // raw meters
    duration: number; // seconds
}

export interface ValhallaTripLeg {
    shape?: string;
    summary?: {
        length?: number; // km
        time?: number; // seconds
    };
}

export interface ValhallaTrip {
    locations?: Array<{
        lat: number;
        lon: number;
    }>;
    legs?: ValhallaTripLeg[];
    summary?: {
        length?: number;
        time?: number;
    };
    status?: number;
    status_message?: string;
}

export interface ValhallaResponse {
    trip?: ValhallaTrip;
    alternates?: Array<{
        trip: ValhallaTrip;
    }>;
    error_code?: number;
    error?: string;
}

export interface RouteConfig {
    label: string;
    costing: string;
    costing_options?: Record<string, unknown>;
    directions_options: {
        units: "km";
    };
}

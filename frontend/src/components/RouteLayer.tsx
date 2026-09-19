import { useEffect } from "react";
import { Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

export interface RouteGeometry {
    type?: string;
    coordinates?: [number, number][]; // [lon, lat] from OSRM GeoJSON
}

export interface RouteData {
    geometry: [number, number][] | RouteGeometry;
    distance_km?: number | string;
    duration_min?: number;
    distance: number; // meters
    duration: number; // seconds
    label?: string;
    weight?: number;
    weight_name?: string;
    legs?: any[];
}

interface RouteLayerProps {
    routeData: RouteData[];
}

// Automatically fit map bounds when a new route is received
function AutoFitBounds({ positions }: { positions: [number, number][] }) {
    const map = useMap();

    useEffect(() => {
        if (positions.length > 0) {
            const bounds = L.latLngBounds(positions);
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        }
    }, [positions, map]);

    return null;
}

export function RouteLayer({ routeData }: RouteLayerProps) {
    if (!routeData || routeData.length === 0) {
        return null;
    }

    // OSRM GeoJSON coordinates are [lon, lat], Leaflet Polyline expects [lat, lon]



    const ROUTE_COLORS = [
        { main: "#2563eb", glow: "#3b82f6" }, // Blue (Main / Route 1)
        { main: "#10b981", glow: "#34d399" }, // Emerald (Alt 1 / Highway-free)
        { main: "#f59e0b", glow: "#fbbf24" }, // Amber (Alt 2 / Back roads)
        { main: "#8b5cf6", glow: "#a78bfa" }, // Purple
    ];

    return (
        <>
            {
                routeData.map((route, index) => {
                    const colorScheme = ROUTE_COLORS[index % ROUTE_COLORS.length];
                    const latLngs: [number, number][] = Array.isArray(route.geometry)
                        ? route.geometry
                        : (route.geometry?.coordinates?.map(([lon, lat]) => [lat, lon]) ?? []);

                    const startPoint = latLngs[0];
                    const endPoint = latLngs[latLngs.length - 1];

                    const distanceKm =
                        route.distance_km !== undefined
                            ? typeof route.distance_km === "number"
                                ? route.distance_km.toFixed(1)
                                : String(route.distance_km)
                            : (route.distance / 1000).toFixed(1);
                    const durationMin =
                        route.duration_min !== undefined
                            ? Math.round(Number(route.duration_min))
                            : Math.round(route.duration / 60);

                    return (
                        <div key={index}>
                            {/* Fit map viewport to show the entire route */}
                            {index === 0 && <AutoFitBounds positions={latLngs} />}

                            {/* Glowing route outline / background */}
                            <Polyline
                                positions={latLngs}
                                pathOptions={{
                                    color: colorScheme.glow,
                                    weight: index === 0 ? 8 : 6,
                                    opacity: 0.35,
                                    lineCap: "round",
                                    lineJoin: "round",
                                }}
                            />

                            {/* Main Crisp Route Line */}
                            <Polyline
                                positions={latLngs}
                                pathOptions={{
                                    color: colorScheme.main,
                                    weight: index === 0 ? 5 : 4,
                                    opacity: 0.9,
                                    lineCap: "round",
                                    lineJoin: "round",
                                    dashArray: index > 0 ? "8, 6" : undefined,
                                }}
                            >
                                <Popup>
                                    <div className="text-xs space-y-1">
                                        <strong className="block text-sm text-blue-600">{route.label || `Route ${index + 1}`}</strong>
                                        <div>Distance: {distanceKm} km</div>
                                        <div>Estimated time: {durationMin} mins</div>
                                    </div>
                                </Popup>
                            </Polyline>

                            {/* Start point marker */}
                            {startPoint && (
                                <Marker
                                    position={startPoint}
                                    icon={L.divIcon({
                                        className: "route-marker-origin",
                                        html: `<div style="background-color: #10b981; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
                                        iconSize: [14, 14],
                                        iconAnchor: [7, 7],
                                    })}
                                >
                                    <Popup>
                                        <strong>Origin</strong>
                                    </Popup>
                                </Marker>
                            )}

                            {/* Destination point marker */}
                            {endPoint && (
                                <Marker
                                    position={endPoint}
                                    icon={L.divIcon({
                                        className: "route-marker-destination",
                                        html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
                                        iconSize: [14, 14],
                                        iconAnchor: [7, 7],
                                    })}
                                >
                                    <Popup>
                                        <div className="text-xs space-y-1">
                                            <strong className="block text-sm">Destination</strong>
                                            <div>Distance: {distanceKm} km</div>
                                            <div>Estimated time: {durationMin} mins</div>
                                        </div>
                                    </Popup>
                                </Marker>
                            )}
                        </div>
                    );                })
            }
        </>
    );
}

export default RouteLayer;

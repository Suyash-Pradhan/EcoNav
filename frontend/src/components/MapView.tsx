
import { useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import Header from './Header'
import RouteLayer, { type RouteData } from './RouteLayer'

const ROUTE_THEMES = [
    { name: "Main Route", color: "#22c55e", bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500" },
    { name: "Alternate 1", color: "#3b82f6", bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500" },
    { name: "Alternate 2", color: "#f97316", bg: "bg-orange-500", text: "text-orange-500", border: "border-orange-500" },
];

function MapView() {
    const [routeData, setRouteData] = useState<RouteData[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    return (
        <div className='h-screen w-full relative overflow-hidden'>
            {/* Top Navigation Search Bar */}
            <div className="flex justify-center items-center z-10 absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-[820px] max-w-[calc(100vw-2rem)] h-16 bg-background/95 backdrop-blur-md border border-border/60 shadow-lg shadow-black/5 rounded-2xl px-2 transition-all">
                <Header onRouteCalculated={(route) => {
                    setRouteData(route);
                    setSelectedIndex(0);
                }} />
            </div>

            {/* Bottom Route Summary & Selection Cards + Subtle Exposure Insight */}
            {routeData.length > 0 && (() => {
                const mainRoute = routeData[0];
                const activeRoute = routeData[selectedIndex] || mainRoute;

                // Find highest exposure alternative
                const otherRoutes = routeData.slice(1);
                const worstRoute = otherRoutes.reduce<RouteData | null>((worst, curr) => {
                    const currExp = curr.aqiSummary?.exposureScore ?? (curr.aqiSummary?.averageAqi ?? 0);
                    const worstExp = worst?.aqiSummary?.exposureScore ?? (worst?.aqiSummary?.averageAqi ?? 0);
                    return currExp > worstExp ? curr : worst;
                }, otherRoutes[0] || null);

                const activeExp = activeRoute?.aqiSummary?.exposureScore ?? 0;
                const activeAqi = activeRoute?.aqiSummary?.averageAqi ?? 0;
                const worstExp = worstRoute?.aqiSummary?.exposureScore ?? 0;
                const worstAqi = worstRoute?.aqiSummary?.averageAqi ?? 0;

                const savingsPct = worstExp > 0 && worstExp > activeExp
                    ? Math.round(((worstExp - activeExp) / worstExp) * 100)
                    : 0;
                const aqiDiff = worstAqi > activeAqi ? worstAqi - activeAqi : 0;

                return (
                    <div className="z-20 absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[calc(100vw-2rem)] transition-all">
                        {/* Subtle Exposure Insight */}
                        {savingsPct > 0 ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/85 dark:bg-zinc-950/85 text-white backdrop-blur-md border border-white/10 rounded-full shadow-lg text-[11px] font-medium">
                                <span className="text-emerald-400 font-bold">🌱 Air Insight:</span>
                                <span>
                                    Save <strong className="text-emerald-300">{savingsPct}% exposure</strong> ({aqiDiff} pts cleaner AQI) vs {worstRoute?.label || "Alternative"}
                                </span>
                            </div>
                        ) : null}

                        {/* Route Buttons Drawer */}
                        <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl">
                            {routeData.map((route, idx) => {
                                const theme = ROUTE_THEMES[idx] || {
                                    name: `Alt ${idx}`,
                                    color: "#8b5cf6",
                                    bg: "bg-purple-500",
                                    text: "text-purple-500",
                                    border: "border-purple-500"
                                };
                                const isSelected = idx === selectedIndex;
                                const distKm = route.distance_km !== undefined ? route.distance_km : (route.distance / 1000).toFixed(1);
                                const durMin = route.duration_min !== undefined ? route.duration_min : Math.round(route.duration / 60);
                                const aqi = route.aqiSummary?.averageAqi;
                                const exposure = route.aqiSummary?.exposureScore;

                                return (
                                    <button
                                        key={`route-card-${idx}`}
                                        onClick={() => setSelectedIndex(idx)}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-200 cursor-pointer border ${isSelected
                                                ? "bg-zinc-100 dark:bg-zinc-800 shadow-md border-zinc-300 dark:border-zinc-700 ring-2 ring-offset-1"
                                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-transparent opacity-75 hover:opacity-100"
                                            }`}
                                        style={{
                                            outlineColor: theme.color,
                                        }}
                                    >
                                        <span
                                            className="w-2.5 h-8 rounded-full shrink-0 shadow-xs"
                                            style={{ backgroundColor: theme.color }}
                                        />
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                                    {route.label || theme.name}
                                                </span>
                                                {aqi !== undefined && (
                                                    <span
                                                        className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md text-white shadow-xs"
                                                        style={{ backgroundColor: theme.color }}
                                                    >
                                                        AQI {aqi}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                                                <span>⏱️ {durMin}m</span>
                                                <span>•</span>
                                                <span>📏 {distKm}km</span>
                                                {exposure !== undefined && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                                                            Exp {exposure}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <MapContainer center={[28.5272527, 77.0441707]} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RouteLayer
                    routeData={routeData}
                    selectedRouteIndex={selectedIndex}
                    onSelectRoute={(idx) => setSelectedIndex(idx)}
                />

                <Marker position={[28.5272527, 77.0441707]} icon={L.icon({ iconUrl: '/rocket.png', iconSize: [35, 35] })}>
                    <Popup>
                        A pretty CSS3 popup. <br /> Easily customizable.
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    )
}

export default MapView

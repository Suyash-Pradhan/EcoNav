
import { useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import Header from './Header'
import RouteLayer, { type RouteData } from './RouteLayer'

function MapView() {
    const [routeData, setRouteData] = useState<RouteData[]>([]);

    return (
        <div className='h-screen w-full relative'>
            <div className="flex justify-center items-center z-10 absolute top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-[820px] max-w-[calc(100vw-2rem)] h-16 bg-background/95 backdrop-blur-md border border-border/60 shadow-lg shadow-black/5 rounded-2xl px-2 transition-all">
                <Header onRouteCalculated={(route) => setRouteData(route)} />
            </div>

            <MapContainer center={[28.5272527, 77.0441707]} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RouteLayer routeData={routeData} />

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
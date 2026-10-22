import { calculatePM25AQI } from "../utils/aqiUtils.js";

const aqiCache = new Map<string, { aqi: number, timestamp: number }>();
const cacheMaxTime = 30 * 60 * 1000;

export async function fetchAqi(lat: number, lon: number): Promise<number> {
    const roundlat = Number(lat.toFixed(2));
    const roundlon = Number(lon.toFixed(2));
    const cachekey = `${roundlat},${roundlon}`
    const cached = aqiCache.get(cachekey);

    if (cached && Date.now() - cached.timestamp < cacheMaxTime) {
        return cached.aqi;
    }

    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${roundlat}&longitude=${roundlon}&hourly=pm10,pm2_5`
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`failed to fetch aqi ${res.status} ${res.statusText}`)
    }

    const data = await res.json();



    const currHour = new Date().toISOString().slice(0, 13) + ':00';

    let hourIndex = data.hourly.time.indexOf(currHour);

    if (hourIndex == -1) {
        hourIndex = data.hourly.time.length - 1;
    }

    const currentPM25 = data.hourly?.pm2_5?.[hourIndex] ?? 0;
    const aqi = calculatePM25AQI(currentPM25);
    if (typeof aqi !== "number" || Number.isNaN(aqi)) {
        throw new Error(`failed to calculate valid aqi from PM2.5: ${currentPM25}`);
    }

    aqiCache.set(cachekey, { aqi, timestamp: Date.now() });

    return aqi;


}
import express from "express"
import type { Express, Router, Request, Response } from "express"
import console from "node:console";

const route: Router = express.Router();

route.post("/route", async (req: Request, res: Response) => {
    const cordinate = req.body.cordinate;
    if (!cordinate) {
        res.json({ error: "Cordinate are required" });
        return;
    }
    const c1 = cordinate[0]; // [lat, lon] from frontend
    const c2 = cordinate[1]; // [lat, lon] from frontend
    console.log(c1, c2, "backend");

    try {
        // OSRM expects coordinates in {longitude},{latitude};{longitude},{latitude} format
        const coords = `${c1[1]},${c1[0]};${c2[1]},${c2[0]}`;
        const osrmUrl =`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=3`;;

        const osrmResponse = await fetch(osrmUrl);
        const data = await osrmResponse.json();
        console.log(data, "data from osrm")
        res.json({ status: "ok", data });
    } catch (error) {
        console.error("OSRM route error:", error);
        res.status(500).json({ error: "Failed to fetch route from OSRM" });
    }
})
export default route;

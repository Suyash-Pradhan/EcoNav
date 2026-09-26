import express from "express";
import type { Router, Request, Response } from "express";
import { getDistinctRoutes, type Coordinate } from "../services/routeService.js";

const route: Router = express.Router();

route.post("/route", async (req: Request, res: Response) => {
    const cordinate = req.body.cordinate;
    if (!cordinate || !Array.isArray(cordinate) || cordinate.length < 2) {
        res.status(400).json({ error: "Coordinates are required: [[lat1, lon1], [lat2, lon2]]" });
        return;
    }

    const c1 = cordinate[0] as Coordinate; // [lat, lon]
    const c2 = cordinate[1] as Coordinate; // [lat, lon]
    const alternatesCount = typeof req.body.alternates === "number" ? req.body.alternates : 3;

    try {
        const routes = await getDistinctRoutes(c1, c2, alternatesCount);
        res.json({
            status: "ok",
            data: { routes },
            routes,
        });
    } catch (error) {
        console.error("Route calculation error:", error);
        res.status(500).json({ error: "Failed to fetch routes" });
    }
});

export default route;

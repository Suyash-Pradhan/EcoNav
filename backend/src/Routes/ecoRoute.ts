import express from "express";
import type { Router, Request, Response } from "express";
import { getDistinctRoutes, type Coordinate } from "../services/routeService.js";

const route: Router = express.Router();

function isValidCoordinate(coord: unknown): coord is Coordinate {
    return (
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === "number" &&
        Number.isFinite(coord[0]) &&
        typeof coord[1] === "number" &&
        Number.isFinite(coord[1]) &&
        coord[0] >= -90 &&
        coord[0] <= 90 &&
        coord[1] >= -180 &&
        coord[1] <= 180
    );
}

route.post("/route", async (req: Request, res: Response) => {
    const cordinate = req.body.cordinate;
    if (!Array.isArray(cordinate) || cordinate.length !== 2) {
        res.status(400).json({ error: "Coordinates must be an array of exactly two coordinates: [[lat1, lon1], [lat2, lon2]]" });
        return;
    }

    const [c1, c2] = cordinate;
    if (!isValidCoordinate(c1) || !isValidCoordinate(c2)) {
        res.status(400).json({
            error: "Each coordinate must have exactly two finite numbers: latitude in [-90, 90] and longitude in [-180, 180]",
        });
        return;
    }

    let alternatesCount = 3;
    if (req.body.alternates !== undefined) {
        const alts = req.body.alternates;
        if (
            typeof alts !== "number" ||
            !Number.isInteger(alts) ||
            alts < 0 ||
            alts > 10
        ) {
            res.status(400).json({
                error: "alternates must be a bounded non-negative integer between 0 and 10",
            });
            return;
        }
        alternatesCount = alts;
    }

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

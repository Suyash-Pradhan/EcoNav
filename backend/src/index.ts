import type { Express } from "express";
import express from "express"
import ecoRoute from "./Routes/ecoRoute.js"

import cors from "cors";

const app: Express = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(ecoRoute);
app.get('/', (req, res) => {
    res.json({ status: "ok" });
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})
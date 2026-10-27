
import express, { type Request, type Response } from "express";
import placeRoutes from "./placeRoutes.js";
import authRoutes from "./authRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import routeRoutes from "./routeRoutes.js";

const app = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Backend Kayutangan Heritage berhasil berjalan!",
  });
});

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "OK",
  });
});

app.use("/api/places", placeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/routes", routeRoutes);

export default app;

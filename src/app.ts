import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "node:path";

import placeRoutes from "./placeRoutes.js";
import authRoutes from "./authRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import routeRoutes from "./routeRoutes.js";
import navigationRoutes from "./navigationRoutes.js";

const app = express();

// Konfigurasi CORS untuk frontend
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// Middleware untuk membaca JSON
app.use(express.json());

// Menampilkan gambar dari folder uploads
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"))
);

// Halaman utama backend
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Backend Kayutangan Heritage berhasil berjalan!",
  });
});

// Mengecek koneksi backend
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "OK",
  });
});

// Routes API
app.use("/api/places", placeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/navigation", navigationRoutes);

export default app;
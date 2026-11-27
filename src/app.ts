
import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "node:path";

import placeRoutes from "./placeRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import routeRoutes from "./routeRoutes.js";
import discoveryRoutes from "./discoveryRoutes.js";
import navigationRoutes from "./navigationRoutes.js";
import reviewRoutes from "./reviewRoutes.js";
import ticketRoutes from "./ticketRoutes.js";

const app = express();

// Konfigurasi CORS untuk Web FE dan Flutter Web
app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan aplikasi mobile dan request tanpa origin
      if (!origin) {
        return callback(null, true);
      }

      // Izinkan localhost dan 127.0.0.1 dengan port apa pun
      const allowedOrigin =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

      if (allowedOrigin.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin tidak diizinkan oleh CORS"));
    },
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
app.use("/api/discovery", discoveryRoutes);
app.use("/api/navigation", navigationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/tickets", ticketRoutes);

export default app;

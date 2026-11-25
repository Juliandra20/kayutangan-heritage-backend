
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";
import { calculateRoute } from "./services/routingService.js";

const router = Router();

router.post("/route", async (req: Request, res: Response) => {
  try {
    const { originPlaceId, destinationPlaceId } = req.body;

    // Validasi ID tempat
    if (
      !Number.isInteger(Number(originPlaceId)) ||
      !Number.isInteger(Number(destinationPlaceId)) ||
      Number(originPlaceId) <= 0 ||
      Number(destinationPlaceId) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "ID titik awal dan tujuan tidak valid.",
      });
    }

    if (Number(originPlaceId) === Number(destinationPlaceId)) {
      return res.status(400).json({
        success: false,
        message: "Titik awal dan tujuan tidak boleh sama.",
      });
    }

    // Ambil data tempat dari database
    const [places]: any = await db.execute(
      `SELECT id, name, latitude, longitude, status
       FROM places
       WHERE id IN (?, ?)`,
      [Number(originPlaceId), Number(destinationPlaceId)]
    );

    if (places.length !== 2) {
      return res.status(404).json({
        success: false,
        message: "Tempat awal atau tujuan tidak ditemukan.",
      });
    }

    const origin = places.find(
      (place: any) => Number(place.id) === Number(originPlaceId)
    );

    const destination = places.find(
      (place: any) => Number(place.id) === Number(destinationPlaceId)
    );

    if (!origin || !destination) {
      return res.status(404).json({
        success: false,
        message: "Tempat tidak ditemukan.",
      });
    }

    if (origin.status !== "Aktif" || destination.status !== "Aktif") {
      return res.status(400).json({
        success: false,
        message: "Tempat yang dipilih tidak aktif.",
      });
    }

    const originLat = Number(origin.latitude);
    const originLng = Number(origin.longitude);
    const destinationLat = Number(destination.latitude);
    const destinationLng = Number(destination.longitude);

    const coordinatesValid = [
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    ].every(Number.isFinite);

    if (
      !coordinatesValid ||
      Math.abs(originLat) > 90 ||
      Math.abs(destinationLat) > 90 ||
      Math.abs(originLng) > 180 ||
      Math.abs(destinationLng) > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Koordinat tempat belum valid.",
      });
    }

    // Hitung rute melalui Routing Service
    const route = await calculateRoute([
      [originLng, originLat],
      [destinationLng, destinationLat],
    ]);

    return res.status(200).json({
      success: true,
      message: "Rute perjalanan berhasil dihitung.",
      data: {
        origin: {
          id: origin.id,
          name: origin.name,
          latitude: originLat,
          longitude: originLng,
        },
        destination: {
          id: destination.id,
          name: destination.name,
          latitude: destinationLat,
          longitude: destinationLng,
        },
        distance: route.distance,
        duration: route.duration,
        coordinates: route.coordinates,
      },
    });
  } catch (error: any) {
    console.error("NAVIGATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan saat menghitung rute.",
    });
  }
});

export default router;

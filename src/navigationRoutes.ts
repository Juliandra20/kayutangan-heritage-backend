
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";

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

    // Ambil koordinat kedua tempat dari database
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
      (place: any) => place.id === Number(originPlaceId)
    );

    const destination = places.find(
      (place: any) => place.id === Number(destinationPlaceId)
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

    // Ambil API Key OpenRouteService
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "API Key OpenRouteService belum dikonfigurasi.",
      });
    }

    // Hitung rute jalan kaki
    const orsResponse = await fetch(
      "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            [originLng, originLat],
            [destinationLng, destinationLat],
          ],
          instructions: false,
        }),
      }
    );

    const orsData: any = await orsResponse.json();

    if (!orsResponse.ok) {
      console.error("OPENROUTESERVICE ERROR:", orsData);

      return res.status(502).json({
        success: false,
        message: "Gagal menghitung jalur perjalanan.",
      });
    }

    const feature = orsData.features?.[0];

    if (!feature) {
      return res.status(502).json({
        success: false,
        message: "Jalur perjalanan tidak ditemukan.",
      });
    }

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
        distance: feature.properties.summary.distance,
        duration: feature.properties.summary.duration,
        coordinates: feature.geometry.coordinates,
      },
    });
  } catch (error: any) {
    console.error("NAVIGATION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghitung rute.",
    });
  }
});

export default router;

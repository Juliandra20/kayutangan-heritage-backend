
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";
import { fetchKayutanganPlaces } from "./services/placeDiscoveryService.js";

const router = Router();

router.get("/places", async (_req: Request, res: Response) => {
  try {
    const places = await fetchKayutanganPlaces();

    return res.status(200).json({
      success: true,
      message: "Data tempat berhasil diambil.",
      total: places.length,
      data: places,
    });
  } catch (error: any) {
    console.error("DISCOVERY ERROR:", error);

    return res.status(502).json({
      success: false,
      message: error.message || "Gagal mengambil data tempat.",
    });
  }
});

router.post("/import", async (_req: Request, res: Response) => {
  try {
    const places = await fetchKayutanganPlaces();

    let imported = 0;
    let skipped = 0;

    for (const place of places) {
      const historicCategories = [
        "monument",
        "memorial",
        "archaeological_site",
        "castle",
        "ruins",
        "building",
        "heritage",
      ];

      const categoryId =
        place.category === "place_of_worship"
          ? 5
          : historicCategories.includes(place.category)
            ? 4
            : 5;

      const [result]: any = await db.execute(
        `INSERT INTO places
          (name, category_id, location_address, latitude,
           longitude, status, osm_id)
         VALUES (?, ?, ?, ?, ?, 'Aktif', ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           category_id = VALUES(category_id),
           location_address = VALUES(location_address),
           latitude = VALUES(latitude),
           longitude = VALUES(longitude)`,
        [
          place.name,
          categoryId,
          place.address,
          place.latitude,
          place.longitude,
          place.osmId,
        ]
      );

      if (result.affectedRows === 1) {
        imported++;
      } else {
        skipped++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Proses import tempat selesai.",
      total: places.length,
      imported,
      updatedOrUnchanged: skipped,
    });
  } catch (error: any) {
    console.error("IMPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengimpor data tempat.",
    });
  }
});

export default router;

import { Router, type Request, type Response } from "express";
import type { ResultSetHeader } from "mysql2";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

import db from "./config/database.js";
import { fetchKayutanganPlaces } from "./services/placeDiscoveryService.js";

const router = Router();

interface CsvPlace {
  osmId: string;
  name: string;
  categoryId: string;
  latitude: string;
  longitude: string;
  address?: string;
}

const allowedNames = new Set([
  "rumah penghulu",
  "rumah jengki",
  "rumah 1870",
  "rumah rindu",
  "rumah nyik asiyah",
  "rumah mbah ndut",
  "gubuk ningrat",
  "rumah jacoeb",
  "rumah jamu",
  "rumah kartini",
]);

const normalize = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

// GET /api/discovery/places
router.get("/places", async (_req: Request, res: Response) => {
  try {
    const places = await fetchKayutanganPlaces();

    const eligible = places.filter((place) =>
      allowedNames.has(normalize(place.name))
    );

    return res.json({
      success: true,
      totalDiscovered: places.length,
      totalEligible: eligible.length,
      data: eligible.map((place) => ({
        ...place,
        categoryId: 1,
        categoryName: "Sejarah",
      })),
    });
  } catch (error: unknown) {
    console.error("PREVIEW PLACES:", error);

    return res.status(502).json({
      success: false,
      message: "Gagal mengambil preview tempat bersejarah.",
    });
  }
});

// GET /api/discovery/candidates
router.get("/candidates", async (_req: Request, res: Response) => {
  try {
    const places = await fetchKayutanganPlaces();

    const data = places.map((place) => {
      let categoryId: number | null = null;
      let categoryName = "Perlu diperiksa";

      switch (place.category) {
        case "restaurant":
        case "fast_food":
        case "food_court":
          categoryId = 2;
          categoryName = "Kuliner";
          break;

        case "cafe":
          categoryId = 8;
          categoryName = "Cafe";
          break;

        case "museum":
        case "attraction":
        case "viewpoint":
          categoryId = 5;
          categoryName = "Wisata";
          break;

        case "historic":
        case "monument":
        case "memorial":
          categoryId = 4;
          categoryName = "Bangunan Bersejarah";
          break;
      }

      return { ...place, categoryId, categoryName };
    });

    return res.json({
      success: true,
      totalDiscovered: places.length,
      data,
    });
  } catch (error: unknown) {
    console.error("PREVIEW CANDIDATES:", error);

    return res.status(502).json({
      success: false,
      message: "Gagal mengambil kandidat OpenStreetMap.",
    });
  }
});

// POST /api/discovery/import-csv
router.post("/import-csv", async (req: Request, res: Response) => {
  const importKey = process.env.DISCOVERY_IMPORT_KEY;

  if (!importKey || req.header("x-import-key") !== importKey) {
    return res.status(403).json({
      success: false,
      message: "Import tidak diizinkan.",
    });
  }

  try {
    const csv = await readFile(
      "C:/Framework/kayutangan-import.csv",
      "utf8"
    );

    const rows: CsvPlace[] = parse(csv, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const name = String(row.name ?? "").trim();
      const osmId = String(row.osmId ?? "").trim();
      const latitude = String(row.latitude ?? "").trim();
      const longitude = String(row.longitude ?? "").trim();

      const lat = Number(latitude);
      const lng = Number(longitude);
      const categoryId = Number(row.categoryId);

      if (
        !name ||
        !osmId ||
        !latitude ||
        !longitude ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180 ||
        ![2, 4, 5, 8].includes(categoryId)
      ) {
        skipped++;
        continue;
      }

      const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO places
          (name, category_id, location_address,
           latitude, longitude, status, osm_id)
         SELECT ?, ?, ?, ?, ?, 'Aktif', ?
         FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM places
           WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
              OR osm_id = ?
         )`,
        [
          name,
          categoryId,
          row.address?.trim() || null,
          lat,
          lng,
          osmId,
          name,
          osmId,
        ]
      );

      if (result.affectedRows === 1) {
        imported++;
      } else {
        skipped++;
      }
    }

    return res.json({
      success: true,
      total: rows.length,
      imported,
      skipped,
    });
  } catch (error: unknown) {
    console.error("IMPORT CSV:", error);

    return res.status(500).json({
      success: false,
      message: "Import CSV gagal. Periksa log backend.",
    });
  }
});

export default router;
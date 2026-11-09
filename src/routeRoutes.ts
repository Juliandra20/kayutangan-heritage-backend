
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const router = Router();

// ========================================
// KONFIGURASI UPLOAD GAMBAR
// ========================================

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  cb
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Format gambar harus JPG, JPEG, PNG, atau WEBP."));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// ========================================
// HELPER: HAPUS FILE GAMBAR
// ========================================

function deleteImage(imageUrl?: string | null) {
  if (!imageUrl) return;

  const filename = path.basename(imageUrl);
  const imagePath = path.join(uploadDir, filename);

  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
}

// ========================================
// HELPER: PARSE PLACE IDS
// ========================================

function parsePlaceIds(value: unknown): number[] {
  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      throw new Error("Format daftar tempat tidak valid.");
    }
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error("Daftar tempat harus berupa array.");
  }

  const placeIds = parsedValue.map((id) => Number(id));

  if (
    placeIds.some(
      (id) => !Number.isInteger(id) || id <= 0
    )
  ) {
    throw new Error("ID tempat tidak valid.");
  }

  return [...new Set(placeIds)];
}

// ========================================
// HELPER: VALIDASI TEMPAT DAN KOORDINAT
// ========================================

async function validatePlaceIds(
  connection: any,
  placeIds: number[]
) {
  if (placeIds.length === 0) {
    throw new Error("Pilih minimal satu tempat untuk rute.");
  }

  const placeholders = placeIds.map(() => "?").join(",");

  const [rows]: any = await connection.execute(
    `SELECT id, latitude, longitude
     FROM places
     WHERE id IN (${placeholders})`,
    placeIds
  );

  // Memastikan semua tempat ditemukan
  if (rows.length !== placeIds.length) {
    throw new Error("Ada tempat yang tidak ditemukan.");
  }

  // Memastikan setiap tempat memiliki koordinat valid
  const placesWithoutCoordinates = rows.filter(
    (place: any) => {
      const latitude = Number(place.latitude);
      const longitude = Number(place.longitude);

      return (
        place.latitude === null ||
        place.latitude === undefined ||
        place.latitude === "" ||
        place.longitude === null ||
        place.longitude === undefined ||
        place.longitude === "" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      );
    }
  );

  if (placesWithoutCoordinates.length > 0) {
    throw new Error(
      "Ada tempat wisata yang belum memiliki koordinat valid. Lengkapi koordinat di Kelola Tempat terlebih dahulu."
    );
  }
}

// ========================================
// HELPER: SIMPAN URUTAN TEMPAT
// ========================================

async function saveRoutePlaces(
  connection: any,
  routeId: number,
  placeIds: number[]
) {
  for (let index = 0; index < placeIds.length; index++) {
    await connection.execute(
      `INSERT INTO route_places
       (route_id, place_id, sequence)
       VALUES (?, ?, ?)`,
      [routeId, placeIds[index], index + 1]
    );
  }
}

// ========================================
// GET: AMBIL SEMUA RUTE
// ========================================

router.get("/", async (_req: Request, res: Response) => {
  try {
    const [routes]: any = await db.execute(
      `SELECT
        r.id,
        r.name,
        r.category_id,
        c.name AS category,
        r.description,
        r.image_url,
        r.location_address,
        r.status,
        r.created_at
       FROM routes r
       LEFT JOIN categories c
         ON r.category_id = c.id
       ORDER BY r.created_at DESC`
    );

    const [routePlaces]: any = await db.execute(
      `SELECT
        rp.route_id,
        rp.place_id,
        rp.sequence,
        p.name,
        p.description,
        p.image_url,
        p.location_address,
        p.latitude,
        p.longitude,
        p.status
       FROM route_places rp
       INNER JOIN places p
         ON rp.place_id = p.id
       ORDER BY rp.route_id, rp.sequence ASC`
    );

    const result = routes.map((route: any) => ({
      ...route,
      image: route.image_url,
      places: routePlaces
        .filter(
          (place: any) => place.route_id === route.id
        )
        .map((place: any) => ({
          id: place.place_id,
          name: place.name,
          description: place.description,
          image: place.image_url,
          location: place.location_address,
          latitude:
            place.latitude !== null
              ? Number(place.latitude)
              : null,
          longitude:
            place.longitude !== null
              ? Number(place.longitude)
              : null,
          status: place.status,
          sequence: place.sequence,
        })),
    }));

    return res.status(200).json({
      success: true,
      message: "Data rute berhasil diambil.",
      data: result,
    });
  } catch (error: any) {
    console.error("GET ROUTES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data rute.",
      error: error.message,
    });
  }
});

// ========================================
// POST: TAMBAH RUTE
// ========================================

router.post(
  "/",
  upload.single("image"),
  async (req: Request, res: Response) => {
    let connection: any;
    let transactionStarted = false;

    try {
      const {
        name,
        category,
        description,
        location,
        status,
      } = req.body;

      if (!name || !category) {
        if (req.file) deleteImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: "Nama dan kategori rute wajib diisi.",
        });
      }

      const placeIds = parsePlaceIds(req.body.placeIds);

      const [categories]: any = await db.execute(
        `SELECT id
         FROM categories
         WHERE name = ?
         LIMIT 1`,
        [category]
      );

      if (categories.length === 0) {
        if (req.file) deleteImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: "Kategori tidak ditemukan.",
        });
      }

      const categoryId = categories[0].id;
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : null;

      connection = await db.getConnection();

      await connection.beginTransaction();
      transactionStarted = true;

      await validatePlaceIds(connection, placeIds);

      const [routeResult]: any = await connection.execute(
        `INSERT INTO routes
         (
           name,
           category_id,
           description,
           image_url,
           location_address,
           status
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          categoryId,
          description || null,
          imageUrl,
          location || null,
          status || "Aktif",
        ]
      );

      const routeId = routeResult.insertId;

      await saveRoutePlaces(
        connection,
        routeId,
        placeIds
      );

      await connection.commit();
      transactionStarted = false;

      return res.status(201).json({
        success: true,
        message: "Rute berhasil ditambahkan.",
        data: {
          id: routeId,
          name,
          category,
          description,
          image: imageUrl,
          location,
          status: status || "Aktif",
          placeIds,
        },
      });
    } catch (error: any) {
      if (connection && transactionStarted) {
        await connection.rollback();
      }

      if (req.file) {
        deleteImage(req.file.filename);
      }

      console.error("POST ROUTE ERROR:", error);

      return res.status(400).json({
        success: false,
        message: error.message || "Gagal menambahkan rute.",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

// ========================================
// PUT: UPDATE RUTE
// ========================================

router.put(
  "/:id",
  upload.single("image"),
  async (req: Request, res: Response) => {
    const routeId = Number(req.params.id);

    let connection: any;
    let transactionStarted = false;

    try {
      const {
        name,
        category,
        description,
        location,
        status,
      } = req.body;

      if (!Number.isInteger(routeId) || routeId <= 0) {
        if (req.file) deleteImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: "ID rute tidak valid.",
        });
      }

      if (!name || !category) {
        if (req.file) deleteImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: "Nama dan kategori rute wajib diisi.",
        });
      }

      const [existingRoutes]: any = await db.execute(
        `SELECT id, image_url
         FROM routes
         WHERE id = ?
         LIMIT 1`,
        [routeId]
      );

      if (existingRoutes.length === 0) {
        if (req.file) deleteImage(req.file.filename);

        return res.status(404).json({
          success: false,
          message: "Rute tidak ditemukan.",
        });
      }

      const oldImage = existingRoutes[0].image_url;

      const [categories]: any = await db.execute(
        `SELECT id
         FROM categories
         WHERE name = ?
         LIMIT 1`,
        [category]
      );

      if (categories.length === 0) {
        if (req.file) deleteImage(req.file.filename);

        return res.status(400).json({
          success: false,
          message: "Kategori tidak ditemukan.",
        });
      }

      const categoryId = categories[0].id;

      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : oldImage;

      connection = await db.getConnection();

      await connection.beginTransaction();
      transactionStarted = true;

      await connection.execute(
        `UPDATE routes
         SET
           name = ?,
           category_id = ?,
           description = ?,
           image_url = ?,
           location_address = ?,
           status = ?
         WHERE id = ?`,
        [
          name.trim(),
          categoryId,
          description || null,
          imageUrl,
          location || null,
          status || "Aktif",
          routeId,
        ]
      );

      // Update urutan tempat jika placeIds dikirim
      if (req.body.placeIds !== undefined) {
        const placeIds = parsePlaceIds(req.body.placeIds);

        await validatePlaceIds(connection, placeIds);

        await connection.execute(
          `DELETE FROM route_places
           WHERE route_id = ?`,
          [routeId]
        );

        await saveRoutePlaces(
          connection,
          routeId,
          placeIds
        );
      }

      await connection.commit();
      transactionStarted = false;

      // Hapus gambar lama setelah transaksi berhasil
      if (req.file && oldImage) {
        deleteImage(oldImage);
      }

      return res.status(200).json({
        success: true,
        message: "Rute berhasil diperbarui.",
      });
    } catch (error: any) {
      if (connection && transactionStarted) {
        await connection.rollback();
      }

      if (req.file) {
        deleteImage(req.file.filename);
      }

      console.error("PUT ROUTE ERROR:", error);

      return res.status(400).json({
        success: false,
        message: error.message || "Gagal memperbarui rute.",
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

// ========================================
// DELETE: HAPUS RUTE
// ========================================

router.delete(
  "/:id",
  async (req: Request, res: Response) => {
    try {
      const routeId = Number(req.params.id);

      if (!Number.isInteger(routeId) || routeId <= 0) {
        return res.status(400).json({
          success: false,
          message: "ID rute tidak valid.",
        });
      }

      const [routes]: any = await db.execute(
        `SELECT image_url
         FROM routes
         WHERE id = ?
         LIMIT 1`,
        [routeId]
      );

      if (routes.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Rute tidak ditemukan.",
        });
      }

      await db.execute(
        `DELETE FROM routes
         WHERE id = ?`,
        [routeId]
      );

      // route_places akan ikut terhapus
      // karena menggunakan ON DELETE CASCADE
      deleteImage(routes[0].image_url);

      return res.status(200).json({
        success: true,
        message: "Rute berhasil dihapus.",
      });
    } catch (error: any) {
      console.error("DELETE ROUTE ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Gagal menghapus rute.",
        error: error.message,
      });
    }
  }
);

export default router;

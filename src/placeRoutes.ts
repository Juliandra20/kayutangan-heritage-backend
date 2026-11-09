
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const router = Router();

// Folder untuk menyimpan gambar tempat wisata
const uploadDir = path.resolve(process.cwd(), "uploads");

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

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("File harus berupa gambar."));
    }
  },
});

// Validasi koordinat
const parseCoordinate = (
  value: unknown,
  min: number,
  max: number
): number | null | undefined => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const coordinate = Number(value);

  if (
    !Number.isFinite(coordinate) ||
    coordinate < min ||
    coordinate > max
  ) {
    return undefined;
  }

  return coordinate;
};

// Mengambil semua tempat beserta nama kategorinya
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id,
        p.name,
        p.category_id,
        c.name AS category,
        p.description,
        p.image_url AS image,
        p.location_address AS location,
        p.latitude,
        p.longitude,
        p.status,
        p.created_at
      FROM places p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id DESC
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error mengambil data tempat:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data tempat wisata.",
    });
  }
});

// Menambahkan tempat baru
router.post(
  "/",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        category,
        description,
        location,
        latitude,
        longitude,
      } = req.body;

      if (!name?.trim() || !category?.trim()) {
        res.status(400).json({
          success: false,
          message: "Nama tempat dan kategori wajib diisi.",
        });
        return;
      }

      const parsedLatitude = parseCoordinate(latitude, -90, 90);
      const parsedLongitude = parseCoordinate(longitude, -180, 180);

      if (
        parsedLatitude === undefined ||
        parsedLongitude === undefined
      ) {
        res.status(400).json({
          success: false,
          message: "Latitude atau longitude tidak valid.",
        });
        return;
      }

      const [categoryRows]: any = await db.execute(
        "SELECT id FROM categories WHERE name = ? LIMIT 1",
        [category.trim()]
      );

      if (categoryRows.length === 0) {
        res.status(400).json({
          success: false,
          message: "Kategori tidak ditemukan. Pilih kategori yang tersedia.",
        });
        return;
      }

      const categoryId = categoryRows[0].id;

      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : "/images/gereja_kayutangan.png";

      const [result]: any = await db.execute(
        `INSERT INTO places
          (
            name,
            category_id,
            description,
            image_url,
            location_address,
            latitude,
            longitude,
            status
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          categoryId,
          description?.trim() || null,
          imageUrl,
          location?.trim() || null,
          parsedLatitude,
          parsedLongitude,
          "Aktif",
        ]
      );

      res.status(201).json({
        success: true,
        message: "Tempat berhasil ditambahkan.",
        data: {
          id: result.insertId,
          name: name.trim(),
          category: category.trim(),
          description: description?.trim() || "",
          image: imageUrl,
          location: location?.trim() || "",
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          status: "Aktif",
        },
      });
    } catch (error) {
      console.error("Error menambahkan tempat:", error);

      res.status(500).json({
        success: false,
        message: "Gagal menambahkan tempat wisata.",
      });
    }
  }
);

// Mengedit tempat berdasarkan ID
router.put(
  "/:id",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      const {
        name,
        category,
        description,
        location,
        latitude,
        longitude,
        status,
      } = req.body;

      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          success: false,
          message: "ID tempat tidak valid.",
        });
        return;
      }

      if (!name?.trim() || !category?.trim()) {
        res.status(400).json({
          success: false,
          message: "Nama tempat dan kategori wajib diisi.",
        });
        return;
      }

      const parsedLatitude = parseCoordinate(latitude, -90, 90);
      const parsedLongitude = parseCoordinate(longitude, -180, 180);

      if (
        parsedLatitude === undefined ||
        parsedLongitude === undefined
      ) {
        res.status(400).json({
          success: false,
          message: "Latitude atau longitude tidak valid.",
        });
        return;
      }

      const [existingRows]: any = await db.execute(
        "SELECT id, image_url FROM places WHERE id = ? LIMIT 1",
        [id]
      );

      if (existingRows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Tempat tidak ditemukan.",
        });
        return;
      }

      const [categoryRows]: any = await db.execute(
        "SELECT id FROM categories WHERE name = ? LIMIT 1",
        [category.trim()]
      );

      if (categoryRows.length === 0) {
        res.status(400).json({
          success: false,
          message: "Kategori tidak ditemukan.",
        });
        return;
      }

      const oldImage = existingRows[0].image_url;

      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : oldImage;

      await db.execute(
        `UPDATE places
         SET
           name = ?,
           category_id = ?,
           description = ?,
           image_url = ?,
           location_address = ?,
           latitude = ?,
           longitude = ?,
           status = ?
         WHERE id = ?`,
        [
          name.trim(),
          categoryRows[0].id,
          description?.trim() || null,
          imageUrl,
          location?.trim() || null,
          parsedLatitude,
          parsedLongitude,
          status === "Nonaktif" ? "Nonaktif" : "Aktif",
          id,
        ]
      );

      // Hapus gambar lama jika diganti dengan gambar baru
      if (req.file && oldImage?.startsWith("/uploads/")) {
        const oldPath = path.join(
          uploadDir,
          path.basename(oldImage)
        );

        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      res.json({
        success: true,
        message: "Tempat berhasil diperbarui.",
        data: {
          id,
          name: name.trim(),
          category: category.trim(),
          description: description?.trim() || "",
          image: imageUrl,
          location: location?.trim() || "",
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          status: status === "Nonaktif" ? "Nonaktif" : "Aktif",
        },
      });
    } catch (error) {
      console.error("Error mengedit tempat:", error);

      res.status(500).json({
        success: false,
        message: "Gagal memperbarui tempat wisata.",
      });
    }
  }
);

// Menghapus tempat berdasarkan ID
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({
        success: false,
        message: "ID tempat tidak valid.",
      });
      return;
    }

    const [rows]: any = await db.execute(
      "SELECT image_url FROM places WHERE id = ? LIMIT 1",
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Tempat tidak ditemukan.",
      });
      return;
    }

    await db.execute(
      "DELETE FROM places WHERE id = ?",
      [id]
    );

    const imageUrl = rows[0].image_url;

    if (imageUrl?.startsWith("/uploads/")) {
      const imagePath = path.join(
        uploadDir,
        path.basename(imageUrl)
      );

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.json({
      success: true,
      message: "Tempat berhasil dihapus.",
    });
  } catch (error) {
    console.error("Error menghapus tempat:", error);

    res.status(500).json({
      success: false,
      message: "Gagal menghapus tempat wisata.",
    });
  }
});

export default router;

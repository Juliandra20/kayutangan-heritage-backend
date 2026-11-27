import { Router } from "express";
import db from "./config/database.js";
import { authenticateToken } from "./middlewares/authMiddleware.js";

const router = Router();

// Ambil ulasan berdasarkan tempat
router.get("/place/:placeId", async (req, res) => {
  const placeId = Number(req.params.placeId);

  if (!Number.isInteger(placeId) || placeId <= 0) {
    return res.status(400).json({
      success: false,
      message: "ID tempat tidak valid.",
    });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, user_id, place_id, rating,
              komentar, foto_ulasan, created_at, updated_at
       FROM ulasan
       WHERE place_id = ?
       ORDER BY created_at DESC`,
      [placeId]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("GET ULASAN:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil ulasan.",
    });
  }
});

// Tambah ulasan
router.post("/", authenticateToken, async (req, res) => {
  const user = res.locals.authUser;
  const placeId = Number(req.body.place_id);
  const rating = Number(req.body.rating);
  const komentar = req.body.komentar ?? req.body.comment ?? null;
  const foto = req.body.foto_ulasan ?? null;

  if (
    !Number.isInteger(placeId) ||
    placeId <= 0 ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return res.status(400).json({
      success: false,
      message: "ID tempat atau rating tidak valid.",
    });
  }

  if (
    (komentar !== null && typeof komentar !== "string") ||
    (foto !== null &&
      (typeof foto !== "string" || foto.length > 255))
  ) {
    return res.status(400).json({
      success: false,
      message: "Format komentar atau foto tidak valid.",
    });
  }

  try {
    const [result]: any = await db.query(
      `INSERT INTO ulasan
       (user_id, place_id, rating, komentar, foto_ulasan)
       SELECT ?, id, ?, ?, ?
       FROM places WHERE id = ?`,
      [user.id, rating, komentar, foto, placeId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Tempat tidak ditemukan.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Ulasan berhasil ditambahkan.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("POST ULASAN:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menambahkan ulasan.",
    });
  }
});

export default router;
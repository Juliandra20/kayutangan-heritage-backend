import { Router } from "express";
import { randomUUID } from "node:crypto";
import db from "./config/database.js";
import { authenticateToken } from "./middlewares/authMiddleware.js";

const router = Router();

// Riwayat tiket milik pengguna
router.get("/", authenticateToken, async (_req, res) => {
  try {
    const user = res.locals.authUser;

    const [rows]: any = await db.query(
      `SELECT * FROM tiket
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [user.id]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("GET tiket:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil tiket."
    });
  }
});

// Buat pesanan tiket
router.post("/", authenticateToken, async (req, res) => {
  try {
    const user = res.locals.authUser;

    const tempatId = Number(req.body.tempat_id);
    const jumlah = Number(req.body.jumlah_tiket);
    const tanggal = req.body.tanggal_kunjungan;

    const kategoriInput = String(
      req.body.kategori_pengunjung ?? ""
    ).trim().toLowerCase();

    if (
      !Number.isInteger(tempatId) || tempatId <= 0 ||
      !Number.isInteger(jumlah) || jumlah <= 0 ||
      typeof tanggal !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)
    ) {
      return res.status(400).json({
        success: false,
        message: "Data pemesanan tidak valid."
      });
    }

    if (kategoriInput !== "warlok" && kategoriInput !== "turis") {
      return res.status(400).json({
        success: false,
        message: "Kategori pengunjung harus Warlok atau Turis."
      });
    }

    const kategori =
      kategoriInput === "warlok" ? "Warlok" : "Turis";

    const harga = Number(
      kategori === "Warlok"
        ? process.env.TICKET_PRICE_WARLOK
        : process.env.TICKET_PRICE_TURIS
    );

    if (!Number.isFinite(harga) || harga <= 0) {
      return res.status(503).json({
        success: false,
        message: "Harga tiket belum dikonfigurasi."
      });
    }

    const [places]: any = await db.query(
      `SELECT id FROM places
       WHERE id = ? AND status = 'Aktif'`,
      [tempatId]
    );

    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tempat tidak ditemukan atau tidak aktif."
      });
    }

    const kode = `KH-${randomUUID()}`;
    const totalHarga = harga * jumlah;

    const [result]: any = await db.query(
      `INSERT INTO tiket
       (kode_tiket, user_id, tempat_id, tanggal_kunjungan,
        jumlah_tiket, kategori_pengunjung, total_harga,
        metode_pembayaran, status_pembayaran, status_tiket)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unused')`,
      [
        kode,
        user.id,
        tempatId,
        tanggal,
        jumlah,
        kategori,
        totalHarga,
        req.body.metode_pembayaran ?? null
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Tiket berhasil dibuat.",
      data: {
        id: result.insertId,
        kode_tiket: kode,
        kategori_pengunjung: kategori,
        jumlah_tiket: jumlah,
        harga_satuan: harga,
        total_harga: totalHarga,
        status_pembayaran: "pending",
        status_tiket: "unused"
      }
    });
  } catch (error) {
    console.error("POST tiket:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat tiket."
    });
  }
});

// Cek status tiket berdasarkan kode
router.get("/status/:kode", authenticateToken, async (req, res) => {
  try {
    const user = res.locals.authUser;

    const [rows]: any = await db.query(
      `SELECT id, kode_tiket, status_pembayaran,
              status_tiket, tanggal_kunjungan
       FROM tiket
       WHERE kode_tiket = ? AND user_id = ?`,
      [req.params.kode, user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tiket tidak ditemukan."
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error("Status tiket:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil status tiket."
    });
  }
});

// Cek akses peta berdasarkan tiket yang sudah dibayar
router.get("/map-access", authenticateToken, async (_req, res) => {
  try {
    const user = res.locals.authUser;

    const [rows]: any = await db.query(
      `SELECT id, kode_tiket, tanggal_kunjungan, status_tiket
       FROM tiket
       WHERE user_id = ?
         AND status_pembayaran = 'paid'
         AND status_tiket IN ('unused', 'used')
         AND tanggal_kunjungan = CURDATE()
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    return res.json({
      success: true,
      has_access: rows.length > 0,
      active_ticket: rows[0] ?? null
    });
  } catch (error) {
    console.error("Akses peta:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memeriksa akses peta."
    });
  }
});

// Batalkan pesanan milik pengguna
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const user = res.locals.authUser;

    const [result]: any = await db.query(
      `UPDATE tiket
       SET status_tiket = 'cancelled'
       WHERE id = ? AND user_id = ?
         AND status_pembayaran = 'pending'
         AND status_tiket = 'unused'`,
      [req.params.id, user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        message: "Tiket tidak ditemukan atau tidak dapat dibatalkan."
      });
    }

    return res.json({
      success: true,
      message: "Pesanan berhasil dibatalkan."
    });
  } catch (error) {
    console.error("Cancel tiket:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal membatalkan tiket."
    });
  }
});

export default router;
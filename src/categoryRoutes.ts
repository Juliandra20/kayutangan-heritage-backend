
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";

const router = Router();

// Mengambil kategori beserta jumlah tempat
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await db.query(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.icon_url AS icon,
        COUNT(p.id) AS count
      FROM categories c
      LEFT JOIN places p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.description, c.icon_url
      ORDER BY c.id ASC
    `);

    return res.json({
      success: true,
      message: "Data kategori berhasil diambil.",
      data: rows,
    });
  } catch (error) {
    console.error("Error mengambil kategori:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data kategori.",
    });
  }
});

// Menambahkan kategori
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, icon } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama kategori wajib diisi.",
      });
    }

    if (typeof icon !== "string" || !icon.trim()) {
      return res.status(400).json({
        success: false,
        message: "Ikon kategori wajib dipilih.",
      });
    }

    const cleanName = name.trim();
    const cleanDescription =
      typeof description === "string" ? description.trim() : "";

    // Memeriksa nama yang sama tanpa membedakan huruf besar/kecil
    const [existing]: any = await db.query(
      `SELECT id FROM categories
       WHERE LOWER(TRIM(name)) = LOWER(?)`,
      [cleanName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Nama kategori sudah digunakan. Silakan gunakan nama lain.",
      });
    }

    const [result]: any = await db.query(
      `INSERT INTO categories (name, description, icon_url)
       VALUES (?, ?, ?)`,
      [cleanName, cleanDescription, icon.trim()]
    );

    return res.status(201).json({
      success: true,
      message: "Kategori berhasil ditambahkan.",
      data: {
        id: result.insertId,
        name: cleanName,
        description: cleanDescription,
        icon: icon.trim(),
        count: 0,
      },
    });
  } catch (error) {
    console.error("Error menambahkan kategori:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menambahkan kategori.",
    });
  }
});

// Mengedit kategori
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, description, icon } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID kategori tidak valid.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama kategori wajib diisi.",
      });
    }

    if (typeof icon !== "string" || !icon.trim()) {
      return res.status(400).json({
        success: false,
        message: "Ikon kategori wajib dipilih.",
      });
    }

    const cleanName = name.trim();
    const cleanDescription =
      typeof description === "string" ? description.trim() : "";

    const [existing]: any = await db.query(
      "SELECT id FROM categories WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan.",
      });
    }

    // Mengecek duplikat, tetapi mengabaikan kategori yang sedang diedit
    const [duplicate]: any = await db.query(
      `SELECT id FROM categories
       WHERE LOWER(TRIM(name)) = LOWER(?)
       AND id != ?`,
      [cleanName, id]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Nama kategori sudah digunakan. Silakan gunakan nama lain.",
      });
    }

    await db.query(
      `UPDATE categories
       SET name = ?, description = ?, icon_url = ?
       WHERE id = ?`,
      [cleanName, cleanDescription, icon.trim(), id]
    );

    return res.json({
      success: true,
      message: "Kategori berhasil diperbarui.",
    });
  } catch (error) {
    console.error("Error memperbarui kategori:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui kategori.",
    });
  }
});

// Menghapus kategori
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID kategori tidak valid.",
      });
    }

    const [existing]: any = await db.query(
      "SELECT id FROM categories WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan.",
      });
    }

    // Cegah penghapusan kategori yang masih digunakan tempat
    const [places]: any = await db.query(
      "SELECT COUNT(*) AS total FROM places WHERE category_id = ?",
      [id]
    );

    if (Number((places as any[])[0].total) > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Kategori tidak bisa dihapus karena masih digunakan oleh tempat.",
      });
    }

    await db.query("DELETE FROM categories WHERE id = ?", [id]);

    return res.json({
      success: true,
      message: "Kategori berhasil dihapus.",
    });
  } catch (error) {
    console.error("Error menghapus kategori:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus kategori.",
    });
  }
});

export default router;

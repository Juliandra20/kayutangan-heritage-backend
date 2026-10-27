
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows] = await db.query("SELECT * FROM categories");

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

export default router;

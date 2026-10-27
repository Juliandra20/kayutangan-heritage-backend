
import { Router, type Request, type Response } from "express";
import db from "./config/database.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query("SELECT * FROM places");

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error mengambil data places:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data tempat wisata",
    });
  }
});

export default router;

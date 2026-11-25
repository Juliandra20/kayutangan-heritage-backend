
import type { Request, Response, NextFunction } from "express";
import AuthToken, { hashToken } from "../models/AuthToken.js";
import User from "../models/User.js";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authorization = req.headers.authorization;

    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan.",
      });
    }

    const userId = await AuthToken.findUserIdByToken(hashToken(token));

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Token tidak valid atau sudah kedaluwarsa.",
      });
    }

    const user = await User.findById(userId);

    if (!user || user.status !== "Aktif") {
      return res.status(401).json({
        success: false,
        message: "Akun tidak aktif atau tidak ditemukan.",
      });
    }

    res.locals.authUser = user;

    return next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memeriksa autentikasi.",
    });
  }
};

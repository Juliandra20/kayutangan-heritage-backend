
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import AuthToken, {
  generateToken,
  hashToken,
} from "../models/AuthToken.js";

type LoginType = "superadmin" | "loket1" | "loket2";

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validLoginTypes: LoginType[] = [
  "superadmin",
  "loket1",
  "loket2",
];

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, loginType } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password ||
      !isValidEmail(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi.",
      });
    }

    if (
      typeof loginType !== "string" ||
      !validLoginTypes.includes(loginType as LoginType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Jenis login tidak valid.",
      });
    }

    const user = await User.findByEmail(email.trim());

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah.",
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah.",
      });
    }

    if (user.status !== "Aktif") {
      return res.status(403).json({
        success: false,
        message: "Akun tidak aktif.",
      });
    }

    const selectedLoginType = loginType as LoginType;

    const roleValid =
      selectedLoginType === "superadmin"
        ? user.role === "superadmin" && user.loket_id === null
        : user.role === "loket" &&
          user.loket_id ===
            (selectedLoginType === "loket1" ? 1 : 2);

    if (!roleValid) {
      return res.status(403).json({
        success: false,
        message: "Akun tidak memiliki akses ke jenis login ini.",
      });
    }

    const token = generateToken();
    const tokenHash = hashToken(token);

    await AuthToken.create(user.id, tokenHash);

    return res.status(200).json({
      success: true,
      message: "Login berhasil.",
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          loket_id: user.loket_id,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login gagal.",
    });
  }
};

export const me = async (_req: Request, res: Response) => {
  const user = res.locals.authUser;

  return res.json({
    success: true,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      loket_id: user.loket_id,
    },
  });
};

export const logout = async (req: Request, res: Response) => {
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

    const revoked = await AuthToken.revoke(hashToken(token));

    if (!revoked) {
      return res.status(401).json({
        success: false,
        message: "Token tidak valid atau sudah dicabut.",
      });
    }

    return res.json({
      success: true,
      message: "Logout berhasil. Token sudah dicabut.",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout gagal.",
    });
  }
};

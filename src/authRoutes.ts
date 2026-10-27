
import { Router, type Request, type Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import db from "./config/database.js";

const router = Router();

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");


const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};


interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password: string;
  status: string | null;
}

interface TokenRow extends RowDataPacket {
  user_id: number;
}

// REGISTER
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { full_name, email, password, phone_number } = req.body;

    
if (
  typeof full_name !== "string" ||
  typeof email !== "string" ||
  typeof password !== "string" ||
  !full_name.trim() ||
  !email.trim() ||
  !isValidEmail(email.trim()) ||
  password.length < 8
) {
  return res.status(400).json({
    success: false,
    message:
      "Nama wajib diisi, format email harus benar, dan password minimal 8 karakter.",
  });
}


    const [existing] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email sudah terdaftar.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO users (full_name, email, phone_number, password, status)
       VALUES (?, ?, ?, ?, 'Aktif')`,
      [
        full_name.trim(),
        email.trim(),
        phone_number || null,
        hashedPassword,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil.",
      data: {
        id: result.insertId,
        full_name: full_name.trim(),
        email: email.trim(),
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      success: false,
      message: "Registrasi gagal.",
    });
  }
});

// LOGIN
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

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

    const [rows] = await db.execute<UserRow[]>(
      `SELECT id, full_name, email, password, status
       FROM users WHERE email = ? LIMIT 1`,
      [email.trim()]
    );

    const user = rows[0];

// Periksa apakah pengguna ditemukan
if (!user) {
  return res.status(401).json({
    success: false,
    message: "Email atau password salah.",
  });
}

// Periksa password
const passwordValid = await bcrypt.compare(password, user.password);

if (!passwordValid) {
  return res.status(401).json({
    success: false,
    message: "Email atau password salah.",
  });
}

// Periksa status akun
if (user.status !== "Aktif") {
  return res.status(403).json({
    success: false,
    message: "Akun tidak aktif.",
  });
}

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    await db.execute(
      `INSERT INTO auth_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))`,
      [user.id, tokenHash]
    );

    
  return res.status(200).json({
  success: true,
  message: "Login berhasil.",
  data: {
    token,
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
});

// CEK TOKEN / PROFIL PENGGUNA
router.get("/me", async (req: Request, res: Response) => {
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

    const [tokens] = await db.execute<TokenRow[]>(
      `SELECT user_id FROM auth_tokens
       WHERE token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [hashToken(token)]
    );

    if (!tokens[0]) {
      return res.status(401).json({
        success: false,
        message: "Token tidak valid atau sudah kedaluwarsa.",
      });
    }

    const [users] = await db.execute<UserRow[]>(
      `SELECT id, full_name, email, password, status
       FROM users WHERE id = ? LIMIT 1`,
      [tokens[0].user_id]
    );

    const user = users[0];

    if (!user || user.status !== "Aktif") {
      return res.status(401).json({
        success: false,
        message: "Akun tidak aktif atau tidak ditemukan.",
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memeriksa token.",
    });
  }
});

// LOGOUT
router.post("/logout", async (req: Request, res: Response) => {
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

    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE auth_tokens
       SET revoked_at = NOW()
       WHERE token_hash = ?
         AND revoked_at IS NULL`,
      [hashToken(token)]
    );

    if (result.affectedRows === 0) {
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
});

export default router;

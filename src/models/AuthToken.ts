
import { createHash, randomBytes } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import db from "../config/database.js";

interface TokenRow extends RowDataPacket {
  user_id: number;
}

export const generateToken = (): string => {
  return randomBytes(32).toString("hex");
};

export const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

const AuthToken = {
  async create(userId: number, tokenHash: string): Promise<void> {
    await db.execute(
      `INSERT INTO auth_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))`,
      [userId, tokenHash]
    );
  },

  async findUserIdByToken(tokenHash: string): Promise<number | null> {
    const [rows] = await db.execute<TokenRow[]>(
      `SELECT user_id
       FROM auth_tokens
       WHERE token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    return rows[0]?.user_id ?? null;
  },

  async revoke(tokenHash: string): Promise<boolean> {
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE auth_tokens
       SET revoked_at = NOW()
       WHERE token_hash = ?
         AND revoked_at IS NULL`,
      [tokenHash]
    );

    return result.affectedRows > 0;
  },
};

export default AuthToken;

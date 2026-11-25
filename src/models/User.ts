
import type { RowDataPacket } from "mysql2";
import db from "../config/database.js";

export type UserRole = "superadmin" | "loket";

export interface UserRecord extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password: string;
  status: string | null;
  role: UserRole;
  loket_id: number | null;
}

export interface PublicUser extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  status: string | null;
  role: UserRole;
  loket_id: number | null;
}

const User = {
  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const [rows] = await db.execute<UserRecord[]>(
      `SELECT id, full_name, email, password, status, role, loket_id
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    return rows[0];
  },

  async findById(id: number): Promise<PublicUser | undefined> {
    const [rows] = await db.execute<PublicUser[]>(
      `SELECT id, full_name, email, status, role, loket_id
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0];
  },
};

export default User;

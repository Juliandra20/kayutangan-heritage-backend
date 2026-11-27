
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import db from "../config/database.js";

export type UserRole = "superadmin" | "loket" | "user";

export interface UserRecord extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password: string;
  phone_number: string | null;
  status: string | null;
  role: UserRole;
  loket_id: number | null;
}

export interface PublicUser extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  status: string | null;
  role: UserRole;
  loket_id: number | null;
}

const User = {
  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const [rows] = await db.execute<UserRecord[]>(
      `SELECT id, full_name, email, password, phone_number,
              status, role, loket_id
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    return rows[0];
  },

  async findById(id: number): Promise<PublicUser | undefined> {
    const [rows] = await db.execute<PublicUser[]>(
      `SELECT id, full_name, email, phone_number,
              status, role, loket_id
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0];
  },

  async findByEmailOrPhone(
    email: string,
    phoneNumber: string
  ): Promise<boolean> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id
       FROM users
       WHERE email = ? OR phone_number = ?
       LIMIT 1`,
      [email, phoneNumber]
    );

    return rows.length > 0;
  },

  async create(data: {
    full_name: string;
    email: string;
    password: string;
    phone_number: string;
  }): Promise<number> {
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO users
       (full_name, email, password, phone_number, role, status, loket_id)
       VALUES (?, ?, ?, ?, 'user', 'Aktif', NULL)`,
      [
        data.full_name,
        data.email,
        data.password,
        data.phone_number,
      ]
    );

    return result.insertId;
  },
};

export default User;

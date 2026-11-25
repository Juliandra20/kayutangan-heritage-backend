
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import db from "../config/database.js";

export interface RoutePlaceInput {
  id: number;
  sequence: number;
}

export interface RouteInput {
  name: string;
  categoryId: number;
  description: string | null;
  imageUrl: string | null;
  location: string | null;
  status: string;
}

const Route = {
  async findAll() {
    const [routes] = await db.execute<RowDataPacket[]>(
      `SELECT
        r.id,
        r.name,
        r.category_id,
        c.name AS category,
        r.description,
        r.image_url,
        r.location_address,
        r.status,
        r.created_at
       FROM routes r
       LEFT JOIN categories c ON r.category_id = c.id
       ORDER BY r.created_at DESC`
    );

    const [routePlaces] = await db.execute<RowDataPacket[]>(
      `SELECT
        rp.route_id,
        rp.place_id,
        rp.sequence,
        p.name,
        p.description,
        p.image_url,
        p.location_address,
        p.latitude,
        p.longitude,
        p.status
       FROM route_places rp
       INNER JOIN places p ON rp.place_id = p.id
       ORDER BY rp.route_id, rp.sequence ASC`
    );

    return routes.map((route) => ({
      ...route,
      image: route.image_url,
      places: routePlaces
        .filter((place) => place.route_id === route.id)
        .map((place) => ({
          id: place.place_id,
          name: place.name,
          description: place.description,
          image: place.image_url,
          location: place.location_address,
          latitude:
            place.latitude !== null
              ? Number(place.latitude)
              : null,
          longitude:
            place.longitude !== null
              ? Number(place.longitude)
              : null,
          status: place.status,
          sequence: place.sequence,
        })),
    }));
  },

  async findById(id: number) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, image_url
       FROM routes
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0];
  },

  async findCategoryByName(name: string) {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id
       FROM categories
       WHERE name = ?
       LIMIT 1`,
      [name]
    );

    return rows[0];
  },

  async validatePlaces(
    connection: PoolConnection,
    placeIds: number[]
  ) {
    if (placeIds.length === 0) {
      throw new Error("Pilih minimal satu tempat untuk rute.");
    }

    const placeholders = placeIds.map(() => "?").join(",");

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, latitude, longitude
       FROM places
       WHERE id IN (${placeholders})`,
      placeIds
    );

    if (rows.length !== placeIds.length) {
      throw new Error("Ada tempat yang tidak ditemukan.");
    }

    const invalidPlaces = rows.filter((place) => {
      const latitude = Number(place.latitude);
      const longitude = Number(place.longitude);

      return (
        place.latitude === null ||
        place.latitude === undefined ||
        place.latitude === "" ||
        place.longitude === null ||
        place.longitude === undefined ||
        place.longitude === "" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      );
    });

    if (invalidPlaces.length > 0) {
      throw new Error(
        "Ada tempat wisata yang belum memiliki koordinat valid. Lengkapi koordinat di Kelola Tempat terlebih dahulu."
      );
    }

    return rows;
  },

  async create(
    connection: PoolConnection,
    data: RouteInput
  ) {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO routes
       (
         name,
         category_id,
         description,
         image_url,
         location_address,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.categoryId,
        data.description,
        data.imageUrl,
        data.location,
        data.status,
      ]
    );

    return result.insertId;
  },

  async savePlaces(
  connection: PoolConnection,
  routeId: number,
  placeIds: number[]
) {
  for (const [index, placeId] of placeIds.entries()) {
    await connection.execute(
      `INSERT INTO route_places
       (route_id, place_id, sequence)
       VALUES (?, ?, ?)`,
      [routeId, placeId, index + 1]
    );
  }
},

  async update(
    connection: PoolConnection,
    id: number,
    data: RouteInput
  ) {
    await connection.execute(
      `UPDATE routes
       SET
         name = ?,
         category_id = ?,
         description = ?,
         image_url = ?,
         location_address = ?,
         status = ?
       WHERE id = ?`,
      [
        data.name,
        data.categoryId,
        data.description,
        data.imageUrl,
        data.location,
        data.status,
        id,
      ]
    );
  },

  async deletePlaces(
    connection: PoolConnection,
    routeId: number
  ) {
    await connection.execute(
      `DELETE FROM route_places WHERE route_id = ?`,
      [routeId]
    );
  },

  async delete(id: number) {
    const [result] = await db.execute<ResultSetHeader>(
      `DELETE FROM routes WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  },
};

export default Route;

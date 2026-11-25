
import type { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";

import db from "../config/database.js";
import Route from "../models/Route.js";

const uploadDir = path.join(process.cwd(), "uploads");

const deleteImage = (imageUrl?: string | null) => {
  if (!imageUrl) return;

  const filename = path.basename(imageUrl);
  const imagePath = path.join(uploadDir, filename);

  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }
};

const parsePlaceIds = (value: unknown): number[] => {
  let parsedValue = value;

  if (typeof value === "string") {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      throw new Error("Format daftar tempat tidak valid.");
    }
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error("Daftar tempat harus berupa array.");
  }

  const placeIds = parsedValue.map(Number);

  if (
    placeIds.some(
      (id) => !Number.isInteger(id) || id <= 0
    )
  ) {
    throw new Error("ID tempat tidak valid.");
  }

  return [...new Set(placeIds)];
};

const getRouteData = async (body: Request["body"], imageUrl: string | null) => {
  const name = String(body.name ?? "").trim();
  const categoryName = String(body.category ?? "").trim();

  if (!name || !categoryName) {
    throw new Error("Nama dan kategori rute wajib diisi.");
  }

  const category = await Route.findCategoryByName(categoryName);

  if (!category) {
    throw new Error("Kategori tidak ditemukan.");
  }

  return {
    name,
    categoryId: Number(category.id),
    description: body.description || null,
    imageUrl,
    location: body.location || null,
    status: body.status || "Aktif",
  };
};

// GET: AMBIL SEMUA RUTE
export const getAllRoutes = async (
  _req: Request,
  res: Response
) => {
  try {
    const routes = await Route.findAll();

    return res.status(200).json({
      success: true,
      message: "Data rute berhasil diambil.",
      data: routes,
    });
  } catch (error) {
    console.error("GET ROUTES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data rute.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// POST: TAMBAH RUTE
export const createRoute = async (
  req: Request,
  res: Response
) => {
  let connection: PoolConnection | undefined;
  let transactionStarted = false;

  try {
    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    const data = await getRouteData(req.body, imageUrl);
    const placeIds = parsePlaceIds(req.body.placeIds);

    connection = await db.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    await Route.validatePlaces(connection, placeIds);

    const routeId = await Route.create(connection, data);

    await Route.savePlaces(connection, routeId, placeIds);

    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Rute berhasil ditambahkan.",
      data: {
        id: routeId,
        name: data.name,
        category: req.body.category,
        description: data.description,
        image: imageUrl,
        location: data.location,
        status: data.status,
        placeIds,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    if (req.file) {
      deleteImage(req.file.filename);
    }

    console.error("POST ROUTE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error instanceof Error
        ? error.message
        : "Gagal menambahkan rute.",
    });
  } finally {
    connection?.release();
  }
};

// PUT: UPDATE RUTE
export const updateRoute = async (
  req: Request,
  res: Response
) => {
  const routeId = Number(req.params.id);

  let connection: PoolConnection | undefined;
  let transactionStarted = false;

  try {
    if (!Number.isInteger(routeId) || routeId <= 0) {
      throw new Error("ID rute tidak valid.");
    }

    const existingRoute = await Route.findById(routeId);

    if (!existingRoute) {
      return res.status(404).json({
        success: false,
        message: "Rute tidak ditemukan.",
      });
    }

    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : existingRoute.image_url;

    const data = await getRouteData(req.body, imageUrl);

    connection = await db.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    await Route.update(connection, routeId, data);

    // Update urutan tempat hanya jika placeIds dikirim
    if (req.body.placeIds !== undefined) {
      const placeIds = parsePlaceIds(req.body.placeIds);

      await Route.validatePlaces(connection, placeIds);
      await Route.deletePlaces(connection, routeId);
      await Route.savePlaces(connection, routeId, placeIds);
    }

    await connection.commit();
    transactionStarted = false;

    // Hapus gambar lama setelah transaksi berhasil
    if (req.file && existingRoute.image_url) {
      deleteImage(existingRoute.image_url);
    }

    return res.status(200).json({
      success: true,
      message: "Rute berhasil diperbarui.",
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    if (req.file) {
      deleteImage(req.file.filename);
    }

    console.error("PUT ROUTE ERROR:", error);

    return res.status(400).json({
      success: false,
      message: error instanceof Error
        ? error.message
        : "Gagal memperbarui rute.",
    });
  } finally {
    connection?.release();
  }
};

// DELETE: HAPUS RUTE
export const deleteRoute = async (
  req: Request,
  res: Response
) => {
  try {
    const routeId = Number(req.params.id);

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID rute tidak valid.",
      });
    }

    const existingRoute = await Route.findById(routeId);

    if (!existingRoute) {
      return res.status(404).json({
        success: false,
        message: "Rute tidak ditemukan.",
      });
    }

    const deleted = await Route.delete(routeId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Rute tidak ditemukan.",
      });
    }

    deleteImage(existingRoute.image_url);

    return res.status(200).json({
      success: true,
      message: "Rute berhasil dihapus.",
    });
  } catch (error) {
    console.error("DELETE ROUTE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus rute.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

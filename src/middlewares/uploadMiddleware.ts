
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  cb
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Format gambar harus JPG, JPEG, PNG, atau WEBP."));
  }
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

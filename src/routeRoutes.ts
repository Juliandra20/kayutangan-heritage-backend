
import { Router } from "express";

import {
  getAllRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
} from "./controllers/routeController.js";

import { uploadImage } from "./middlewares/uploadMiddleware.js";

const router = Router();

router.get("/", getAllRoutes);

router.post("/", uploadImage.single("image"), createRoute);

router.put("/:id", uploadImage.single("image"), updateRoute);

router.delete("/:id", deleteRoute);

export default router;

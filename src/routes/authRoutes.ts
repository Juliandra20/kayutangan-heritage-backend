
import { Router } from "express";

import {
  login,
  me,
  logout,
} from "../controllers/authController.js";

import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/login", login);
router.get("/me", authenticateToken, me);
router.post("/logout", logout);

export default router;

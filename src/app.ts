
import express, { Request, Response } from "express";

const app = express();

app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Backend Kayutangan Heritage berhasil berjalan!",
  });
});

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "OK",
  });
});

export default app;

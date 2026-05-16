import express from "express";
import cors from "cors";
import router from "./routes/rag.js";

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.use("/api/chat", router);

app.get("/", (_req, res) => {
  res.json({
    name: "img2pdf backend",
    ok: true,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

export default app;

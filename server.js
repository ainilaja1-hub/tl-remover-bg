import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(allowed.includes(file.mimetype) ? null : new Error("Format harus JPG, PNG, atau WEBP."), allowed.includes(file.mimetype));
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (_req, res) => {
  res.json({ ready: Boolean(process.env.REMOVE_BG_API_KEY) });
});

app.post("/api/remove-background", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.REMOVE_BG_API_KEY) {
      return res.status(503).json({ error: "API belum diaktifkan. Admin perlu mengisi REMOVE_BG_API_KEY pada file .env." });
    }
    if (!req.file) return res.status(400).json({ error: "Silakan pilih foto terlebih dahulu." });

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    form.append("image_file", blob, req.file.originalname || "upload-image");
    form.append("size", "auto");

    const upstream = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": process.env.REMOVE_BG_API_KEY },
      body: form
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(upstream.status).json({ error: "Layanan AI gagal memproses foto. Periksa API key, kuota, dan batas ukuran foto.", detail: detail.slice(0, 500) });
    }

    const output = Buffer.from(await upstream.arrayBuffer());
    res.set("Content-Type", "image/png");
    res.set("Content-Disposition", 'attachment; filename="tl-remover-bg.png"');
    res.send(output);
  } catch (err) {
    res.status(500).json({ error: err.message || "Terjadi kesalahan pada server." });
  }
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Permintaan tidak valid." });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TL Remover BG berjalan di http://localhost:${port}`));
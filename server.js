import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// If yt-dlp isn't on PATH, set YT_DLP_PATH to the full binary path.
const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";

const PLATFORMS = [
  { id: "tiktok", label: "TikTok", test: /tiktok\.com/i },
  { id: "youtube", label: "YouTube", test: /(youtube\.com|youtu\.be)/i },
  { id: "instagram", label: "Instagram", test: /instagram\.com/i },
  { id: "pinterest", label: "Pinterest", test: /(pinterest\.[a-z.]+|pin\.it)/i },
  { id: "facebook", label: "Facebook", test: /(facebook\.com|fb\.watch)/i },
];

function detectPlatform(url) {
  return PLATFORMS.find((p) => p.test.test(url)) || null;
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", (err) => reject(err)); // e.g. ENOENT — yt-dlp not installed
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim().split("\n").pop() || "yt-dlp failed"));
      } else {
        resolve(stdout);
      }
    });
  });
}

function safeFilename(name) {
  return (name || "video").replace(/[/\\?%*:|"<>]/g, "").slice(0, 80);
}

// Health check — lets the frontend warn the user if yt-dlp isn't installed
app.get("/api/health", async (req, res) => {
  try {
    await runYtDlp(["--version"]);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// Fetch video metadata + available formats
app.post("/api/info", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "লিংক দাওনি" });
  }

  const platform = detectPlatform(url.trim());
  if (!platform) {
    return res.status(400).json({
      error: "এই লিংকটা TikTok, YouTube, Instagram, Pinterest বা Facebook এর মনে হচ্ছে না",
    });
  }

  try {
    const out = await runYtDlp(["-j", "--no-warnings", "--no-playlist", url.trim()]);
    const info = JSON.parse(out.trim().split("\n")[0]);

    const seen = new Set();
    const formats = (info.formats || [])
      .filter((f) => f.url && (f.vcodec !== "none" || f.acodec !== "none"))
      .map((f) => {
        const isAudioOnly = f.vcodec === "none" && f.acodec !== "none";
        const label = isAudioOnly
          ? `অডিও ${f.ext.toUpperCase()} · ${f.abr ? Math.round(f.abr) + "kbps" : ""}`
          : `${f.height ? f.height + "p" : f.format_note || "video"} · ${f.ext.toUpperCase()}`;
        return {
          format_id: f.format_id,
          ext: f.ext,
          label: label.trim(),
          filesize: f.filesize || f.filesize_approx || null,
          isAudioOnly,
          height: f.height || 0,
        };
      })
      .filter((f) => {
        if (seen.has(f.label)) return false;
        seen.add(f.label);
        return true;
      })
      .sort((a, b) => b.height - a.height);

    res.json({
      platform: platform.id,
      platformLabel: platform.label,
      title: info.title || "video",
      thumbnail: info.thumbnail || null,
      duration: info.duration || null,
      uploader: info.uploader || info.channel || null,
      formats,
    });
  } catch (err) {
    const missing = /ENOENT/i.test(err.message || "");
    res.status(500).json({
      error: missing
        ? "yt-dlp পাওয়া যায়নি — সার্ভারে ইনস্টল করা আছে কিনা চেক করো (README দেখো)"
        : "ভিডিও তথ্য আনা যায়নি। লিংকটা public কিনা, বা ঠিক আছে কিনা চেক করো।",
      detail: err.message,
    });
  }
});

// Stream the chosen format straight to the browser (nothing saved on the server)
app.get("/api/download", (req, res) => {
  const { url, format_id, ext, title } = req.query;
  if (!url) return res.status(400).send("url প্রয়োজন");

  const filename = `${safeFilename(title)}.${ext || "mp4"}`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/octet-stream");

  const args = ["-f", format_id || "best", "-o", "-", "--no-warnings", "--no-playlist", url];
  const proc = spawn(YT_DLP, args);

  proc.stdout.pipe(res);
  proc.on("error", () => {
    if (!res.headersSent) res.status(500).end("ডাউনলোড শুরু করা যায়নি");
  });
  proc.stderr.on("data", () => {}); // yt-dlp logs progress to stderr — ignore
  req.on("close", () => proc.kill());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server চলছে: http://localhost:${PORT}`);
});

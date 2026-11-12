const express = require("express");
const cors = require("cors");
const { spawn, execFile } = require("child_process");
const util = require("util");

const execFilePromise = util.promisify(execFile);
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ১. হেলথ চেক রুট
app.get("/health", (req, res) => {
  res.send("API is running!");
});

// ২. মেটাডেটা ও কোয়ালিটি আনার রুট (আপডেটেড ও এরর-প্রুফ)
app.post("/get-info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    // সরাসরি সিস্টেম yt-dlp বাইনারি কল এবং ইউটিউব বট-ব্লক বাইপাস আর্গুমেন্ট
    const { stdout } = await execFilePromise("yt-dlp", [
      "-J",
      "--no-warnings",
      "--no-check-certificates",
      "--extractor-args",
      "youtube:player_client=android,web",
      url,
    ]);

    const info = JSON.parse(stdout);
    const formatsMap = new Map();

    if (info.formats && Array.isArray(info.formats)) {
      info.formats.forEach((f) => {
        if (f.height && f.ext === "mp4") {
          const resolution = `${f.height}p`;
          const size = f.filesize || f.filesize_approx;

          if (
            !formatsMap.has(resolution) ||
            (size && !formatsMap.get(resolution).filesize)
          ) {
            const mb = size
              ? (size / (1024 * 1024)).toFixed(1) + " MB"
              : "Adaptive";
            formatsMap.set(resolution, {
              formatId: f.format_id,
              quality: resolution,
              ext: "mp4",
              type: "video",
              sizeText: mb,
            });
          }
        }
      });
    }

    const qualities = Array.from(formatsMap.values()).sort(
      (a, b) => parseInt(b.quality) - parseInt(a.quality),
    );

    // অডিও অপশন
    qualities.push({
      formatId: "bestaudio",
      quality: "Audio Only (MP3)",
      ext: "mp3",
      type: "audio",
      sizeText: "High Bitrate",
    });

    res.json({
      title: info.title || "Extracted Video",
      thumbnail: info.thumbnail || "",
      qualities,
    });
  } catch (error) {
    console.error("Info Error Details:", error.stderr || error.message);
    res.status(500).json({
      error: "Failed to extract video details",
      details: error.stderr || error.message, // ব্রাউজারে আসল এরর দেখার জন্য
    });
  }
});

// ৩. চ্যাঙ্ক-বাই-চ্যাঙ্ক ডাউনলোড রুট
app.get("/download", (req, res) => {
  const { url, formatId = "best", type = "video" } = req.query;

  if (!url) return res.status(400).send("URL is required");

  const ext = type === "audio" ? "mp3" : "mp4";
  const contentType = type === "audio" ? "audio/mpeg" : "video/mp4";

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="download-${Date.now()}.${ext}"`,
  );
  res.setHeader("Content-Type", contentType);

  const args = [
    "-f",
    type === "audio" ? "bestaudio" : `${formatId}+bestaudio/best`,
    "--extractor-args",
    "youtube:player_client=android,web",
    "-o",
    "-",
    url,
  ];

  const ytdlpProcess = spawn("yt-dlp", args);

  ytdlpProcess.stdout.pipe(res);

  ytdlpProcess.stderr.on("data", (data) => {
    console.error(`yt-dlp log: ${data}`);
  });

  ytdlpProcess.on("error", (err) => {
    console.error("Process error:", err);
    if (!res.headersSent) res.status(500).send("Streaming failed");
  });

  req.on("close", () => {
    ytdlpProcess.kill();
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

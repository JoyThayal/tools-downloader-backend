const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const { create } = require("yt-dlp-exec");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ১. হেলথ চেক রুট (Render স্লিপ থেকে জেগেছে কি না বোঝার জন্য)
app.get("/health", (req, res) => {
  res.send("API is running!");
});

// ২. মেটাডেটা ও কোয়ালিটি আনার রুট
app.post("/get-info", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    const ytdlp = create("yt-dlp");
    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
    });

    const formatsMap = new Map();
    if (info.formats && Array.isArray(info.formats)) {
      info.formats.forEach((f) => {
        if (f.height && f.ext === "mp4") {
          const resolution = `${f.height}p`;
          const size = f.filesize || f.filesize_approx;

          if (!formatsMap.has(resolution) || (size && !formatsMap.get(resolution).filesize)) {
            const mb = size ? (size / (1024 * 1024)).toFixed(1) + " MB" : "Adaptive";
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
      (a, b) => parseInt(b.quality) - parseInt(a.quality)
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
    console.error("Info Error:", error);
    res.status(500).json({ error: "Failed to extract video details" });
  }
});

// ৩. চ্যাঙ্ক-বাই-চ্যাঙ্ক মেমোরি-সেফ ডাউনলোড রুট (বড় ভিডিওর জন্য)
app.get("/download", (req, res) => {
  const { url, formatId = "best", type = "video" } = req.query;

  if (!url) return res.status(400).send("URL is required");

  const ext = type === "audio" ? "mp3" : "mp4";
  const contentType = type === "audio" ? "audio/mpeg" : "video/mp4";

  res.setHeader("Content-Disposition", `attachment; filename="download-${Date.now()}.${ext}"`);
  res.setHeader("Content-Type", contentType);

  // yt-dlp চাইল্ড প্রসেস (সরাসরি রেসপন্স স্ট্রিমে পাইপ হবে)
  const args = [
    "-f",
    type === "audio" ? "bestaudio" : `${formatId}+bestaudio/best`,
    "-o",
    "-",
    url,
  ];

  const process = spawn("yt-dlp", args);

  // মেমোরি ফাঁকা রেখে সরাসরি ক্লায়েন্টে ডেটা পাঠানো
  process.stdout.pipe(res);

  process.stderr.on("data", (data) => {
    console.error(`yt-dlp log: ${data}`);
  });

  process.on("error", (err) => {
    console.error("Process error:", err);
    if (!res.headersSent) res.status(500).send("Streaming failed");
  });

  req.on("close", () => {
    process.kill(); // ইউজার ডাউনলোড ক্যানসেল করলে প্রসেস বন্ধ
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
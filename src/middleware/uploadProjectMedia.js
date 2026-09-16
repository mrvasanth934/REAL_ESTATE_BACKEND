const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "..", "uploads", "projects", req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const allowedTypes = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  brochure: ["application/pdf"],
  master_plan: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

const fileFilter = (req, file, cb) => {
  const mediaType = req.body.media_type;
  const allowed = allowedTypes[mediaType];
  if (!allowed) return cb(new Error("Invalid or missing media_type"), false);
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type for ${mediaType}.`), false);
  }
  cb(null, true);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });
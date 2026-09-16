const multer = require("multer");
const path = require("path");
const fs = require("fs");

const slugify = (str = "") =>
  str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "property";

const allowedMimes = {
  image: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  document: ["application/pdf", "image/jpeg", "image/png"],
};

const ALL_ALLOWED_MIMES = Array.from(new Set(Object.values(allowedMimes).flat()));

const inferMediaType = (mimetype = "") => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  return "document"; 
};

const fileFilter = (req, file, cb) => {
  if (!ALL_ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, PDF, MP4, MOV, WEBM`), false);
  }
  cb(null, true);
};
function buildUploader(resolveContext) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const { folder } = resolveContext(req);
        req._uploadFolder = folder; // stashed so the controller can build the public URL
        const dir = path.join(__dirname, "..", "..", "uploads", "properties", folder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      try {
        const { propertyName } = resolveContext(req);
        const ext = path.extname(file.originalname).toLowerCase();
        const originalBase = slugify(path.basename(file.originalname, ext));
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `${originalBase || slugify(propertyName)}-${unique}${ext}`);
      } catch (err) {
        cb(err);
      }
    },
  });

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB — matches the form's copy
  });
}
const namePart = (str, fallback) =>
  slugify(str).replace(/-/g, "") || fallback;

const draftUploader = buildUploader((req) => ({
  folder: "",
  propertyName: [
    namePart(req.body.property_name, "property"),
    namePart(req.body.owner_name, "owner"),
    namePart(req.body.tenant_name, "tenant"),
  ].join("_"),
}));
const scopedUploader = buildUploader((req) => ({
  // Keep the physical folder and the public URL on the same stable key.
  folder: String(req.property?._id || req.params.id),
  propertyName: req.property?.title || req.body.property_name || "property-media",
}));

function buildOwnerUploader(resolveContext) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        const { folder } = resolveContext(req);
        req._uploadFolder = folder;
        const dir = path.join(__dirname, "..", "..", "uploads", "owners", folder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      try {
        const { ownerName } = resolveContext(req);
        const base = slugify(ownerName);
        req._fileCounter = (req._fileCounter || 0) + 1;
        const suffix = req._fileCounter > 1 ? `-${req._fileCounter}` : "";
        const unique = Date.now().toString(36);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${base}${suffix}-${unique}${ext}`);
      } catch (err) {
        cb(err);
      }
    },
  });

  return multer({ storage, fileFilter, limits: { fileSize: 30 * 1024 * 1024 } });
}

const ownerUploader = buildOwnerUploader((req) => ({
  folder: req.params.id,
  ownerName: req.owner?.name,
}));

module.exports = { draftUploader, scopedUploader, ownerUploader, inferMediaType, slugify };
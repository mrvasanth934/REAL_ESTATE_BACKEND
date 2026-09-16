const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderType = req.body.folderType || "leaseagreements";
    const uploadDir = path.join(__dirname, "..", "..", "uploads", folderType);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const rawOwner = req.body.rentalOwner || "unknown_owner";
    const rawTenant = req.body.rentalTenant || "unknown_tenant";

    const ownerName = rawOwner.trim().replace(/\s+/g, "_").toLowerCase();
    const tenantName = rawTenant.trim().replace(/\s+/g, "_").toLowerCase();

    const ext = path.extname(file.originalname) || ".png";
    const uniqueId = Date.now().toString().slice(-4);
    const customFileName = `lease_agreement_${ownerName}_${tenantName}_${uniqueId}${ext}`;

    cb(null, customFileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("INVALID_IMAGE_FORMAT"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const propertyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "..", "uploads", "propertys");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdir(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    console.log(file);
    cb(null, file, originalname);
  },
});

const uploadPropertyMedia = multer({
  storage: propertyStorage,
});

const agreementStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(
      __dirname,
      "..",
      "..",
      "uploads",
      "rentalbooking",
    );

    fs.mkdirSync(uploadDir, { recursive: true });

    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const owner = req.body.rentalOwner || "owner";
    const tenant = req.body.rentalTenant || "tenant";

    const ownerName = owner
      .toString()
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();

    const tenantName = tenant
      .toString()
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();

    const ext = path.extname(file.originalname) || ".png";

    const fileName = `lease_agreement_${ownerName}_${tenantName}_${Date.now()}${ext}`;

    cb(null, fileName);
  },
});

const agreementFileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"), false);
  }
};

const agreementUpload = multer({
  storage: agreementStorage,
  fileFilter: agreementFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "..", "..", "uploads", "documents");

    fs.mkdirSync(uploadDir, { recursive: true });

    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const originalName = path
      .basename(file.originalname, ext)
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .toLowerCase();

    const fileName = `${originalName}_${Date.now()}${ext}`;

    cb(null, fileName);
  },
});

const documentFileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, WEBP, PDF and DOC files are allowed"), false);
  }
};

const documentUpload = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = {
  upload,
  uploadPropertyMedia,
  agreementUpload,
  documentUpload,
};

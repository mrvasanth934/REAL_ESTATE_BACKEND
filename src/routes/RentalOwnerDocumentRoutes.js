const express = require("express");
const rentalOwnerDocumentRoutes = express.Router();

const {
  createDocument,
  uploadDocuments,
  getDocuments,
  deleteDocument,
} = require("../controllers/RentalDocumentController");
const { documentUpload } = require("../middleware/upload");

const { protect, tenantScope } = require("../middleware/authMiddleware");
rentalOwnerDocumentRoutes.use(protect);
rentalOwnerDocumentRoutes.use(tenantScope);

rentalOwnerDocumentRoutes.get("/", getDocuments);
rentalOwnerDocumentRoutes.post("/", createDocument);
rentalOwnerDocumentRoutes.post(
  "/documents",
  documentUpload.single("documents"),
  uploadDocuments,
);
rentalOwnerDocumentRoutes.delete("/:id", deleteDocument);

module.exports = rentalOwnerDocumentRoutes;

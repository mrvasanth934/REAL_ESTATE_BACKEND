const express = require("express");
const {
  getInvoices,
  createInvoice,
  updateInvoice,
} = require("../controllers/BuilderInvoiceController");

const BuilderInvoiceRoutes = express.Router();

BuilderInvoiceRoutes.get("/", getInvoices);
BuilderInvoiceRoutes.post("/", createInvoice);
BuilderInvoiceRoutes.put("/:id", updateInvoice);

module.exports = BuilderInvoiceRoutes;

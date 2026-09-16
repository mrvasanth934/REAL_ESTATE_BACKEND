const Property = require("../models/Property");
const PropertyOwner = require("../models/PropertyOwner");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { inferMediaType } = require("../middleware/uploadMedia");

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isMediaLibraryItem = (media) =>
  media?.source === "media_library" ||
  (!media?.source && Boolean(media?.file_name) && media?.file_size !== undefined && media?.file_size !== null);

// A property must ship with at least one image — either an uploaded file or a pasted link.
const hasAtLeastOneImage = (media) =>
  Array.isArray(media) &&
  media.some((m) => m && m.media_type === "image" && m.url);

exports.createProperty = async (req, res) => {
  try {
    console.log(req.body);
    
    const tenant_id = req.tenantId;
    const listed_by = req.user._id;
    console.log(req.body);

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant context required to create property.",
      });
    }

    if (!hasAtLeastOneImage(req.body.media)) {
      return res.status(400).json({
        success: false,
        message:
          "Add at least one image (upload a file or paste a link) before saving the property.",
      });
    }

    const property = await Property.create({
      ...req.body,
      tenant_id, 
      listed_by, 
    });
    if(property){
      const owner = await PropertyOwner.findOne({_id:req.body.owner_id})
      owner.properties.push(property._id)
      await owner.save()
      return res.status(201).json({ success: true, data: property });
    }
    return res.status(400).json({
      success:false,
      message:"can`t create Property"
    })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// LIST (with filters + pagination) — always tenant scoped
exports.getProperties = async (req, res) => {
  try {
    const tenant_id = req.tenantId;

    if (!tenant_id) {
      // super_admin without x-tenant-id header — don't leak cross-tenant data
      return res.status(400).json({
        success: false,
        message: "x-tenant-id header required to view properties.",
      });
    }

    const {
      type,
      city,
      status,
      minPrice,
      maxPrice,
      owner_id,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { tenant_id };

    if (type) filter.property_type = type;
    if (city) filter.city = new RegExp(city, "i");
    if (status) filter.status = status;
    if (owner_id && mongoose.Types.ObjectId.isValid(owner_id))
      filter.owner_id = owner_id;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .populate("owner_id", "name phone")
        .populate("listed_by", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Property.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: properties,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET SINGLE
exports.getPropertyById = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid property id" });
    }
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const property = await Property.findOne({ _id: id, tenant_id })
      .populate("owner_id")
      .populate("listed_by", "name email role");

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPropertyByIds = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    console.log(tenant_id);
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const property = await Property.find({ tenant_id: tenant_id })
      .populate("owner_id")
      .populate("listed_by", "name email role");

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE
exports.updateProperty = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    delete req.body.tenant_id;
    delete req.body.listed_by;

    if (req.body.media !== undefined && !hasAtLeastOneImage(req.body.media)) {
      return res.status(400).json({
        success: false,
        message:
          "Property must have at least one image (upload a file or paste a link).",
      });
    }

    const property = await Property.findOneAndUpdate(
      { _id: id, tenant_id },
      { $set: req.body },
      { new: true, runValidators: true },
    );

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    res.json({ success: true, data: property });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE
exports.deleteProperty = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    const property = await Property.findOneAndDelete({ _id: id, tenant_id });

    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    res.json({ success: true, message: "Property deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Fetches the property + tenant-scopes it BEFORE multer runs, so the scoped
// uploader can name files after the property's real, saved title.
exports.loadPropertyForMedia = async (req, res, next) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid property id" });
    }
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const property = await Property.findOne({ _id: id, tenant_id });
    if (!property) {
      return res
        .status(404)
        .json({ success: false, message: "Property not found" });
    }

    req.property = property;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADD MEDIA — supports either:
//   (a) uploaded file(s) via multer (req.files, field name "files"), OR
//   (b) a direct link, sent as JSON: { media_type, url, sort_order }
exports.addPropertyMedia = async (req, res) => {
  const uploadedPaths = (req.files || []).map((file) => file.path).filter(Boolean);
  const cleanupUploadedFiles = () => {
    uploadedPaths.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
    });
  };

  try {
    const property = req.property;
    const tenant_id = req.tenantId;
    const newEntries = [];
    const existingCount = property.media?.length || 0;

    if (req.files && req.files.length) {
      const incomingNames = req.files.map((file) => file.originalname.trim().toLowerCase());
      const duplicateInRequest = incomingNames.find((name, index) => incomingNames.indexOf(name) !== index);
      if (duplicateInRequest) {
        cleanupUploadedFiles();
        return res.status(409).json({ success: false, message: `Duplicate file name not allowed: ${duplicateInRequest}` });
      }

      const duplicateProperty = await Property.findOne({
        tenant_id,
        media: {
          $elemMatch: {
            file_name: { $in: req.files.map((file) => new RegExp(`^${escapeRegExp(file.originalname)}$`, "i")) },
            $or: [
              { source: "media_library" },
              { source: { $exists: false }, file_size: { $exists: true } },
            ],
          },
        },
      }).lean();

      if (duplicateProperty) {
        const duplicateName = req.files.find((file) =>
          (duplicateProperty.media || []).some((m) =>
            m.file_name && m.file_name.toLowerCase() === file.originalname.toLowerCase()
          )
        )?.originalname || "file";
        cleanupUploadedFiles();
        return res.status(409).json({ success: false, message: `A media file named "${duplicateName}" already exists.` });
      }

      req.files.forEach((file, idx) => {
        newEntries.push({
          media_type: req.body.media_type || inferMediaType(file.mimetype),
          url: `/uploads/properties/${property._id}/${file.filename}`,
          file_name: file.originalname,
          file_size: file.size,
          label: (req.body.label || "").trim(),
          source: "media_library",
          sort_order: existingCount + idx,
          uploaded_at: new Date(),
        });
      });
    } else if (req.body.url) {
      const normalizedUrl = String(req.body.url).trim();
      const duplicateUrl = await Property.exists({
        tenant_id,
        media: {
          $elemMatch: {
            url: normalizedUrl,
            $or: [{ source: "media_library" }, { source: { $exists: false }, file_name: { $exists: true } }],
          },
        },
      });
      if (duplicateUrl) {
        return res.status(409).json({ success: false, message: "This media URL already exists." });
      }

      newEntries.push({
        media_type: req.body.media_type || "document",
        url: normalizedUrl,
        file_name: req.body.file_name || normalizedUrl.split("/").pop(),
        file_size: Number(req.body.file_size) || 0,
        label: (req.body.label || "").trim(),
        source: "media_library",
        sort_order: req.body.sort_order ?? existingCount,
        uploaded_at: new Date(),
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Provide file(s) to upload (field 'files') or a media 'url' link.",
      });
    }

    property.media.push(...newEntries);
    await property.save();
    res.status(201).json({ success: true, data: newEntries });
  } catch (err) {
    cleanupUploadedFiles();
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET ALL MEDIA — flattens every property's media[] into one list, newest
// first, so the media dashboard can show which property + which file +
// when it was uploaded + where it's stored + its size, across properties.
exports.getAllPropertyMedia = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    if (!tenant_id) {
      return res.status(400).json({ success: false, message: "x-tenant-id header required." });
    }

    const { media_type, page = 1, limit = 60 } = req.query;
    const properties = await Property.find({ tenant_id })
      .select("title city media listed_by")
      .populate("listed_by", "name email")
      .lean();

    let files = [];
    properties.forEach((p) => {
      (p.media || []).forEach((m) => {
        // New records are explicitly tagged. Legacy dedicated-media records had
        // file_name/file_size; property-form media did not, so this keeps old
        // media-library uploads visible without leaking property form images.
        const isMediaLibrary =
          m.source === "media_library" ||
          (!m.source && Boolean(m.file_name) && m.file_size !== undefined && m.file_size !== null);
        if (!isMediaLibrary) return;

        files.push({
          _id: m._id,
          property_id: p._id,
          property_title: p.title,
          property_city: p.city,
          media_type: m.media_type,
          url: m.url,
          file_name: m.file_name || (m.url || "").split("/").pop(),
          file_size: Number(m.file_size) || 0,
          label: m.label || "",
          uploaded_at: m.uploaded_at || null,
          uploaded_by: p.listed_by?.name || p.listed_by?.email || "User",
        });
      });
    });

    // Defensive de-duplication for legacy data. Prefer the newest entry.
    files.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
    const seen = new Set();
    files = files.filter((file) => {
      const key = String(file.file_name || file.url || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const unfiltered = files;
    const filtered = media_type ? unfiltered.filter((f) => f.media_type === media_type) : unfiltered;
    const total = filtered.length;
    const start = (Number(page) - 1) * Number(limit);
    const paged = filtered.slice(start, start + Number(limit));

    const summary = {
      total: unfiltered.length,
      image: unfiltered.filter((f) => f.media_type === "image").length,
      video: unfiltered.filter((f) => f.media_type === "video").length,
      document: unfiltered.filter((f) => f.media_type === "document").length,
      total_size: unfiltered.reduce((sum, f) => sum + (Number(f.file_size) || 0), 0),
      image_size: unfiltered.filter((f) => f.media_type === "image").reduce((sum, f) => sum + (Number(f.file_size) || 0), 0),
      video_size: unfiltered.filter((f) => f.media_type === "video").reduce((sum, f) => sum + (Number(f.file_size) || 0), 0),
      document_size: unfiltered.filter((f) => f.media_type === "document").reduce((sum, f) => sum + (Number(f.file_size) || 0), 0),
      recent_uploads: unfiltered.filter((f) => {
        if (!f.uploaded_at) return false;
        return Date.now() - new Date(f.uploaded_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
      }).length,
    };

    res.json({
      success: true,
      data: paged,
      summary,
      recent: unfiltered.slice(0, 5),
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.max(1, Math.ceil(total / Number(limit))) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPLOAD DRAFT MEDIA — used while a property is still being created (no _id yet).
// Files land in uploads/properties/drafts/<slug-of-title>/ and the returned
// URLs are pushed into form.media on the client, then submitted as part of
// the create-property payload.
exports.uploadDraftMedia = async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res
        .status(400)
        .json({ success: false, message: "No files received." });
    }

    const folder = req._uploadFolder; // set by the draft multer storage engine
    const data = req.files.map((file, idx) => ({
      media_type: inferMediaType(file.mimetype),
      url: `/uploads/properties/${folder}/${file.filename}`,
      file_name: file.originalname,
      file_size: file.size,
      source: "property_form",
      sort_order: idx,
      uploaded_at: new Date(),
    }));

    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// PROPERTY OWNER
exports.createPropertyOwner = async (req, res) => {
  console.log(req.body)
  try {
    const tenant_id = req.tenantId;
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "Tenant context required." });
    }
    const isExist = await PropertyOwner.findOne({ $or : [{email: req.body.email},{phone:req.body.phone }] })
    if (isExist) {
      return res.status(400).json({ success: false, message: "Owner alreday exists by the email id or Mobilee number" });
    }
    const owner = await PropertyOwner.create({ ...req.body, tenant_id });
    console.log(owner);
    res.status(201).json({ success: true, data: owner });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/properties/owners/list?search=xxx&page=1&limit=20
exports.getPropertyOwners = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const { search = "", page = 1, limit = 20 } = req.query;
    const filter = { tenant_id };

    // search by name OR phone — only when user types something
    if (search.trim()) {
      filter.$or = [
        { name: new RegExp(search.trim(), "i") },
        { phone: new RegExp(search.trim(), "i") },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [owners, total] = await Promise.all([
      PropertyOwner.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(Number(limit)),
      PropertyOwner.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: owners,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// PATCH /api/properties/owners/:id
exports.updatePropertyOwner = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    const allowedFields = [
      "name",
      "phone",
      "email",
      "pan_number",
      "aadhaar_number",
      "address",
    ];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const owner = await PropertyOwner.findOneAndUpdate(
      { _id: id, tenant_id },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner not found" });
    }

    res.json({ success: true, data: owner });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/properties/owners/:id — single owner (for the drawer)
exports.getPropertyOwnerById = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid owner id" });
    }
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const owner = await PropertyOwner.findOne({ _id: id, tenant_id });
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner not found" });
    }

    res.json({ success: true, data: owner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.loadOwnerForMedia = async (req, res, next) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid owner id" });
    }
    if (!tenant_id) {
      return res
        .status(400)
        .json({ success: false, message: "x-tenant-id header required." });
    }

    const owner = await PropertyOwner.findOne({ _id: id, tenant_id });
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner not found" });
    }

    req.owner = owner;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/properties/owners/:id/media — upload KYC/owner documents
exports.addOwnerMedia = async (req, res) => {
  try {
    const owner = req.owner; // set by loadOwnerForMedia

    if (!req.files || !req.files.length) {
      return res
        .status(400)
        .json({ success: false, message: "No files received." });
    }

    if (!Array.isArray(owner.documents)) owner.documents = [];

    const newEntries = req.files.map((file) => ({
      doc_type: req.body.doc_type || inferMediaType(file.mimetype),
      url: `/uploads/owners/${owner._id}/${file.filename}`,
      uploaded_at: new Date(),
    }));

    owner.documents.push(...newEntries);
    await owner.save();

    res.status(201).json({ success: true, data: owner.documents });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE /api/properties/owners/:id
exports.deletePropertyOwner = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id } = req.params;

    // Prevent deleting an owner who is still linked to a property
    const linkedProperty = await Property.findOne({ owner_id: id, tenant_id });
    if (linkedProperty) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — this owner is linked to property "${linkedProperty.title}". Reassign or delete that property first.`,
      });
    }

    const owner = await PropertyOwner.findOneAndDelete({ _id: id, tenant_id });

    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "Owner not found" });
    }

    res.json({ success: true, message: "Owner deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.updatePropertyMedia = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id, mediaId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const property = await Property.findOne({ _id: id, tenant_id });
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    const media = property.media.id(mediaId);
    if (!media || !isMediaLibraryItem(media)) {
      return res.status(404).json({ success: false, message: "Media item not found" });
    }

    if (req.body.label !== undefined) media.label = String(req.body.label).trim().slice(0, 120);
    if (["image", "video", "document"].includes(req.body.media_type)) media.media_type = req.body.media_type;
    await property.save();
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deletePropertyMedia = async (req, res) => {
  try {
    const tenant_id = req.tenantId;
    const { id, mediaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(mediaId)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    if (!tenant_id) {
      return res.status(400).json({ success: false, message: "x-tenant-id header required." });
    }

    const property = await Property.findOne({ _id: id, tenant_id });
    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    const media = property.media.id(mediaId);
    if (!media || !isMediaLibraryItem(media)) {
      return res.status(404).json({ success: false, message: "Media item not found" });
    }

    const fileUrl = media.url;
    media.deleteOne();
    await property.save();

    if (fileUrl && fileUrl.startsWith("/uploads/")) {
      const relative = fileUrl.replace(/^\/uploads\//, "");
      const uploadRoot = path.resolve(__dirname, "..", "..", "uploads");
      const absolute = path.resolve(uploadRoot, relative);
      if (absolute.startsWith(uploadRoot + path.sep) && fs.existsSync(absolute)) {
        try { fs.unlinkSync(absolute); } catch (_) {}
      }
    }

    res.json({ success: true, message: "Media deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


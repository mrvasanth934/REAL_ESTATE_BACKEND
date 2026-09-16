const Document = require("../models/RentalOwnerDocument");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");

const createDocument = async (req, res) => {
  try {
    const { user_id, doc_type, file_url } = req.body;

    if (!doc_type || !file_url) {
      return res.status(400).json({
        success: false,
        message: "doc_type and file_url are required",
      });
    }

    if (["super_admin", "tenant_owner"].includes(req.user.role)) {
      const user = await User.findOne({ _id: user_id });
      user.documents.push({
        doc_type,
        file_url,
        uploaded_by: req.user._id,
        uploaded_by_model: "SuperAdmin",
      });
      await user.save();
      return res.status(201).json({
        success: true,
        message: "Document created successfully",
        data: user,
      });
    } else {
      const user = await User.findOne({ _id: req.user._id });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.documents.push({
        doc_type,
        file_url,
        uploaded_by: req.user._id,
        uploaded_by_model: "User",
      });

      await user.save();

      return res.status(201).json({
        success: true,
        message: "Document created successfully",
        data: user,
      });
    }
  } catch (error) {
    console.error("Create Document Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const getDocuments = async (req, res) => {
  try {
    let filter = {
      tenant_id: req.tenantId,
    };

    const documents = await User.find(filter).populate("tenant_id");
    return res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    console.error("Get Documents Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// 3. Get Single Document by ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findOne({
      _id: id,
      tenant_id: req.tenantId || req.user?.tenant_id,
    }).populate("uploaded_by", "name email");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Get Document By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// 4. Update Document
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { doc_type, file_url } = req.body;

    const updatedDocument = await Document.findOneAndUpdate(
      {
        _id: id,
        tenant_id: req.tenantId || req.user?.tenant_id,
      },
      { doc_type, file_url },
      { new: true, runValidators: true },
    );

    if (!updatedDocument) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document updated successfully",
      data: updatedDocument,
    });
  } catch (error) {
    console.error("Update Document Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// 5. Delete Document
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({
      tenant_id: req.tenantId || req.user?.tenant_id,
      "documents._id": id,
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    const document = user.documents.id(id);

    if (!document) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    const fileUrl = document.file_url;
    document.deleteOne();
    await user.save();
    if (fileUrl) {
      try {
        const relativePath = fileUrl.replace(/^\/+/, "");
        const filePath = path.join(process.cwd(), relativePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("Physical file deleted:", filePath);
        } else {
          console.log("Physical file not found:", filePath);
        }
      } catch (fileError) {
        console.error("Failed to delete physical file:", fileError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete Document Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const uploadDocuments = async (req, res) => {
  try {
    if (!req.file || req.file.length === 0) {
      return res.status(400).json({
        message: "Documents are required",
      });
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: "Documents uploaded successfully",
      file_url: fileUrl,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  uploadDocuments,
};

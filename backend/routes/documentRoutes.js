const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const {
  createDocument,
  deleteDocumentById,
  getDocumentById,
  getRawDocumentById,
  listDocuments,
  updateDocumentById,
} = require("../data/documents");
const { getDatabase, mutateDatabase } = require("../data/database");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { processDocumentWithAI } = require("../services/groqService");

const canAccessDocument = (user, document) => {
  if (!user || !document) return false;

  if (user.familyId) {
    return document.familyId === user.familyId;
  }

  return document.uploadedBy === user._id;
};

// ── POST /api/documents/upload ───────────────────────────
// Upload a file + trigger async AI processing
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { label } = req.body;

    // Save document record immediately (AI fills in later)
    const doc = await createDocument({
      uploadedBy: req.user._id,
      familyId: req.user.familyId,
      originalName: req.file.originalname,
      filePath: req.file.filename,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      label: label || "",
      aiStatus: "pending",
    });

    // Respond immediately — don't make user wait for AI
    res.status(201).json({ message: "File uploaded successfully", document: doc });

    // AI processing happens in background (fire and forget)
    processDocumentWithAI(req.file.originalname, req.file.mimetype)
      .then(async (aiResult) => {
        await updateDocumentById(doc._id, {
          category: aiResult.category,
          summary: aiResult.summary,
          extractedInfo: aiResult.extractedInfo,
          tags: aiResult.tags,
          aiStatus: "done",
        });
        console.log(`✅ AI processed: ${req.file.originalname}`);
      })
      .catch(async (err) => {
        await updateDocumentById(doc._id, { aiStatus: "failed" });
        console.error("❌ AI processing error:", err.message);
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// ── GET /api/documents ───────────────────────────────────
// Admin: all family docs | Member: only their own docs
router.get("/", protect, async (req, res) => {
  try {
    const docs = await listDocuments((document) => canAccessDocument(req.user, document));

    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

// ── GET /api/documents/:id ───────────────────────────────
router.get("/:id", protect, async (req, res) => {
  try {
    const rawDoc = await getRawDocumentById(req.params.id);

    if (!rawDoc) return res.status(404).json({ message: "Document not found" });

    if (!canAccessDocument(req.user, rawDoc)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const doc = await getDocumentById(req.params.id);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch document" });
  }
});

// ── DELETE /api/documents/:id ────────────────────────────
// Admin can delete any doc; member can delete their own only
router.delete("/:id", protect, async (req, res) => {
  try {
    const doc = await getRawDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!canAccessDocument(req.user, doc)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (req.user.role !== "admin" && doc.uploadedBy !== req.user._id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, "../uploads", doc.filePath);
    if (fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }

    await deleteDocumentById(req.params.id);

    // Clean up: remove document ID from emergencyDocuments
    await mutateDatabase(async (db) => {
      const emergencyDocs = db.emergencyDocuments || [];
      const index = emergencyDocs.indexOf(req.params.id);
      if (index !== -1) {
        db.emergencyDocuments.splice(index, 1);
      }
    });

    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;

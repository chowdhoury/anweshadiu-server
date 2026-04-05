const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

const db = () => client.db("anwesha");

// POST /contracts - Create a new contract when an application is accepted
router.post("/", async (req, res) => {
  try {
    const {
      postId,
      applicationId,
      projectId,
      author,
      helper,
      rewardPoints,
      title,
      description,
      category,
      tags,
      deadline,
      urgency,
    } = req.body;

    if (!postId || !applicationId || !author?.email || !helper?.email) {
      return res.status(400).json({
        error: "postId, applicationId, author, and helper are required",
      });
    }

    const contractsCollection = db().collection("contracts");

    // Prevent duplicate contract for the same application
    const existing = await contractsCollection.findOne({
      applicationId: new ObjectId(applicationId),
    });
    if (existing) {
      return res.json({
        message: "Contract already exists",
        contract: existing,
      });
    }

    const now = new Date().toISOString();

    const contract = {
      postId: new ObjectId(postId),
      applicationId: new ObjectId(applicationId),
      projectId: projectId ? new ObjectId(projectId) : null,

      // Author (request owner) identity
      author: {
        uid: author.uid || null,
        email: author.email,
        displayName: author.displayName || "User",
        photoURL: author.photoURL || null,
      },

      // Helper (accepted applicant) identity
      helper: {
        uid: helper.uid || null,
        email: helper.email,
        displayName: helper.displayName || "User",
        photoURL: helper.photoURL || null,
      },

      // Reward details
      rewardPoints: Number(rewardPoints) || 0,
      rewardStatus: "reserved", // reserved | released | refunded | disputed

      // Request/project metadata
      title: title || "Untitled",
      description: description || "",
      category: category || "",
      tags: tags || [],
      deadline: deadline || "",
      urgency: urgency || "LOW",

      // Contract status
      status: "active", // active | completed | cancelled | disputed

      // Timestamps
      createdAt: now,
      updatedAt: now,
    };

    const result = await contractsCollection.insertOne(contract);
    contract._id = result.insertedId;

    res.json({ message: "Contract created successfully", contract });
  } catch (err) {
    console.error("POST /contracts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /contracts?email=xxx - Get all contracts for a user (as author or helper)
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "email query param required" });
    }

    const contractsCollection = db().collection("contracts");
    const contracts = await contractsCollection
      .find({
        $or: [{ "author.email": email }, { "helper.email": email }],
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(contracts);
  } catch (err) {
    console.error("GET /contracts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /contracts/:id - Get a single contract by ID
router.get("/:id", async (req, res) => {
  try {
    const contractsCollection = db().collection("contracts");
    const contract = await contractsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(contract);
  } catch (err) {
    console.error("GET /contracts/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /contracts/post/:postId - Get all contracts for a specific post
router.get("/post/:postId", async (req, res) => {
  try {
    const contractsCollection = db().collection("contracts");
    const contracts = await contractsCollection
      .find({ postId: new ObjectId(req.params.postId) })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(contracts);
  } catch (err) {
    console.error("GET /contracts/post/:postId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /contracts/application/:applicationId - Get contract for a specific application
router.get("/application/:applicationId", async (req, res) => {
  try {
    const contractsCollection = db().collection("contracts");
    const contract = await contractsCollection.findOne({
      applicationId: new ObjectId(req.params.applicationId),
    });
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(contract);
  } catch (err) {
    console.error("GET /contracts/application/:applicationId error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /contracts/:id - Update contract status or rewardStatus
router.patch("/:id", async (req, res) => {
  try {
    const { status, rewardStatus } = req.body;
    const update = { updatedAt: new Date().toISOString() };

    if (status) update.status = status;
    if (rewardStatus) update.rewardStatus = rewardStatus;

    const contractsCollection = db().collection("contracts");
    const result = await contractsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }

    res.json({ message: "Contract updated successfully", result });
  } catch (err) {
    console.error("PATCH /contracts/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

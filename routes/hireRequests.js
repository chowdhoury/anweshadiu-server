const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

const db = () => client.db("anwesha");

// POST /hire-requests - Create a new hire request from Skill Detail page
router.post("/", async (req, res) => {
  try {
    const {
      skillId,
      skillTitle,
      package: packageName,
      rewardPoints,
      deliveryDays,
      message,
      client: clientInfo,
      provider,
    } = req.body;

    if (!skillId || !clientInfo?.uid || !provider?.uid) {
      return res.status(400).json({
        error: "skillId, client, and provider are required",
      });
    }

    const collection = db().collection("hireRequests");
    const now = new Date().toISOString();

    const hireRequest = {
      skillId: new ObjectId(skillId),
      skillTitle: skillTitle || "Untitled",

      client: {
        uid: clientInfo.uid,
        email: clientInfo.email,
        name: clientInfo.name || "User",
        photoURL: clientInfo.photoURL || null,
      },

      provider: {
        uid: provider.uid,
        email: provider.email,
        name: provider.name || "User",
        photoURL: provider.photoURL || null,
      },

      package: packageName || "",
      rewardPoints: Number(rewardPoints) || 0,
      deliveryDays: Number(deliveryDays) || 7,
      message: message || "",

      status: "pending", // pending | accepted | declined | cancelled
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.insertOne(hireRequest);
    hireRequest._id = result.insertedId;

    res.json({ message: "Hire request sent successfully", hireRequest });
  } catch (err) {
    console.error("POST /hire-requests error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /hire-requests?email=xxx - Get hire requests for a user (as client or provider)
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "email query param required" });
    }

    const collection = db().collection("hireRequests");
    const requests = await collection
      .find({
        $or: [{ "client.email": email }, { "provider.email": email }],
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(requests);
  } catch (err) {
    console.error("GET /hire-requests error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /hire-requests/:id - Get a single hire request
router.get("/:id", async (req, res) => {
  try {
    const collection = db().collection("hireRequests");
    const hireRequest = await collection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!hireRequest) {
      return res.status(404).json({ error: "Hire request not found" });
    }
    res.json(hireRequest);
  } catch (err) {
    console.error("GET /hire-requests/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /hire-requests/:id - Update hire request status
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const collection = db().collection("hireRequests");
    const result = await collection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status, updatedAt: new Date().toISOString() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Hire request not found" });
    }

    res.json({ message: "Hire request updated successfully" });
  } catch (err) {
    console.error("PATCH /hire-requests/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

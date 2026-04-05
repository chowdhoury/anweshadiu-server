const express = require("express");
const router = express.Router();
const { client } = require("../db");
const usersCollection = client.db("anwesha").collection("users");

router.get("/", async (req, res) => {
  const users = await usersCollection.find({}).toArray();
  res.send(users);
});

router.post("/", async (req, res) => {
  const user = req.body;
  const isExisting = await usersCollection.findOne({ email: user.email });
  if (isExisting) {
    return res.send({ message: "User already exists" });
  }
  user.tobereleased = 0;
  const result = await usersCollection.insertOne(user);
  res.send({ message: "User created successfully" });
});

router.get("/:email", async (req, res) => {
  try {
    const user = await usersCollection.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /users/:email - Update user profile fields
router.patch("/:email", async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "profilePicture",
      "bio",
      "location",
      "website",
      "skills",
      "github",
      "linkedin",
      "twitter",
    ];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    updates.updatedAt = new Date().toISOString();

    const result = await usersCollection.updateOne(
      { email: req.params.email },
      { $set: updates },
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const updatedUser = await usersCollection.findOne({
      email: req.params.email,
    });
    res.json(updatedUser);
  } catch (err) {
    console.error("PATCH /users/:email error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /users/:email/stats - Aggregated profile stats
router.get("/:email/stats", async (req, res) => {
  try {
    const email = req.params.email;
    const contractsCollection = client.db("anwesha").collection("contracts");
    const applicationsCollection = client
      .db("anwesha")
      .collection("applications");

    const [contracts, applications] = await Promise.all([
      contractsCollection
        .find({
          $or: [{ "author.email": email }, { "helper.email": email }],
        })
        .toArray(),
      applicationsCollection.find({ "applicant.email": email }).toArray(),
    ]);

    const completedContracts = contracts.filter(
      (c) => c.status === "completed",
    );
    const helpGiven = completedContracts.filter(
      (c) => c.helper?.email === email,
    ).length;
    const helpReceived = completedContracts.filter(
      (c) => c.author?.email === email,
    ).length;
    const activeContracts = contracts.filter(
      (c) => c.status === "active",
    ).length;

    // Build recent activity from contracts
    const recentActivity = contracts.slice(0, 10).map((c) => ({
      type: c.helper?.email === email ? "helped" : "received",
      title: c.title || "Untitled task",
      reward:
        c.helper?.email === email
          ? `+${c.rewardPoints || 0} pts`
          : `-${c.rewardPoints || 0} pts`,
      time: c.createdAt,
      status: c.status,
    }));

    res.json({
      tasksCompleted: completedContracts.length,
      helpGiven,
      helpReceived,
      activeContracts,
      totalContracts: contracts.length,
      totalApplications: applications.length,
      recentActivity,
    });
  } catch (err) {
    console.error("GET /users/:email/stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

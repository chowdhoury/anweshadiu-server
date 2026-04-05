const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

const db = () => client.db("anwesha");

// POST /projects - Create or update a project when an offer is accepted
// One request (postId) = one project. Additional accepted offers add members.
router.post("/", async (req, res) => {
  try {
    const {
      postId,
      owner,
      helper,
      title,
      description,
      category,
      tags,
      rewardPoints,
      deadline,
      urgency,
    } = req.body;

    if (!postId || !owner?.email || !helper?.email) {
      return res
        .status(400)
        .json({ error: "postId, owner, and helper are required" });
    }

    const projectsCollection = db().collection("projects");
    const usersCollection = db().collection("users");
    const requestedReward = Number(rewardPoints) || 0;

    // Check if a project already exists for this request
    const existing = await projectsCollection.findOne({
      postId: new ObjectId(postId),
    });

    if (existing) {
      // Project exists — add the helper as a new member if not already in
      const alreadyMember = existing.members.some(
        (m) => m.email === helper.email,
      );
      if (alreadyMember) {
        return res.json({
          message: "Helper already in project",
          project: existing,
        });
      }

      // Check balance for this offer's expectedReward
      if (requestedReward > 0) {
        const ownerUser = await usersCollection.findOne({ email: owner.email });
        if (!ownerUser) {
          return res.status(404).json({ error: "Owner user not found" });
        }
        const balance = ownerUser.rewardPoints || 0;
        const reserved = ownerUser.tobereleased || 0;
        const available = balance - reserved;

        if (available < requestedReward) {
          return res.status(400).json({
            error: "Insufficient reward points",
            required: requestedReward,
            available,
            balance,
            tobereleased: reserved,
          });
        }

        await usersCollection.updateOne(
          { email: owner.email },
          { $inc: { tobereleased: requestedReward } },
        );
      }

      await projectsCollection.updateOne(
        { _id: existing._id },
        {
          $push: {
            members: {
              uid: helper.uid || null,
              email: helper.email,
              displayName: helper.displayName || "User",
              photoURL: helper.photoURL || null,
              role: "helper",
              expectedReward: requestedReward,
            },
          },
          $set: { updatedAt: new Date().toISOString() },
          $inc: { rewardPoints: requestedReward },
        },
      );

      const updated = await projectsCollection.findOne({ _id: existing._id });
      return res.json({
        message: "Helper added to existing project",
        project: updated,
      });
    }

    // ─── Check owner's available balance before creating project ───
    if (requestedReward > 0) {
      const ownerUser = await usersCollection.findOne({ email: owner.email });
      if (!ownerUser) {
        return res.status(404).json({ error: "Owner user not found" });
      }
      const balance = ownerUser.rewardPoints || 0;
      const reserved = ownerUser.tobereleased || 0;
      const available = balance - reserved;

      if (available < requestedReward) {
        return res.status(400).json({
          error: "Insufficient reward points",
          required: requestedReward,
          available,
          balance,
          tobereleased: reserved,
        });
      }

      // Reserve the reward by incrementing tobereleased
      await usersCollection.updateOne(
        { email: owner.email },
        { $inc: { tobereleased: requestedReward } },
      );
    }

    // No project yet — create one
    const project = {
      postId: new ObjectId(postId),
      owner: {
        uid: owner.uid || null,
        email: owner.email,
        displayName: owner.displayName || "User",
        photoURL: owner.photoURL || null,
      },
      members: [
        {
          uid: owner.uid || null,
          email: owner.email,
          displayName: owner.displayName || "User",
          photoURL: owner.photoURL || null,
          role: "owner",
        },
        {
          uid: helper.uid || null,
          email: helper.email,
          displayName: helper.displayName || "User",
          photoURL: helper.photoURL || null,
          role: "helper",
          expectedReward: requestedReward,
        },
      ],
      title: title || "Untitled Project",
      description: description || "",
      category: category || "",
      tags: tags || [],
      rewardPoints: rewardPoints || 0,
      deadline: deadline || "",
      urgency: urgency || "LOW",
      status: "in_progress",
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await projectsCollection.insertOne(project);
    project._id = result.insertedId;

    res.json({ message: "Project created successfully", project });
  } catch (err) {
    console.error("POST /projects error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /projects?email=xxx - Get all projects for a user (as owner or helper)
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "email query param required" });
    }

    const projectsCollection = db().collection("projects");
    const projects = await projectsCollection
      .find({
        "members.email": email,
      })
      .sort({ updatedAt: -1 })
      .toArray();

    res.json(projects);
  } catch (err) {
    console.error("GET /projects error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /projects/count - Get count of completed projects
router.get("/count", async (req, res) => {
  try {
    const projectsCollection = db().collection("projects");
    const completed = await projectsCollection.countDocuments({
      status: "completed",
    });
    res.json({ completed });
  } catch (err) {
    console.error("GET /projects/count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /projects/:id - Get a single project by ID
router.get("/:id", async (req, res) => {
  try {
    const projectsCollection = db().collection("projects");
    const project = await projectsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (err) {
    console.error("GET /projects/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /projects/:id - Update project status / progress
router.patch("/:id", async (req, res) => {
  try {
    const { status, progress } = req.body;
    const update = { updatedAt: new Date().toISOString() };
    if (status) update.status = status;
    if (progress !== undefined) update.progress = Number(progress);

    const projectsCollection = db().collection("projects");
    const result = await projectsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: update },
    );
    res.json({ message: "Project updated", result });
  } catch (err) {
    console.error("PATCH /projects/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /projects/:id/action - Handle project actions (cancel, delivered, revision)
router.post("/:id/action", async (req, res) => {
  try {
    const { actionType, senderUid, senderName, senderPhoto, message } =
      req.body;

    if (!actionType || !senderUid) {
      return res
        .status(400)
        .json({ error: "actionType and senderUid are required" });
    }

    const validActions = [
      "cancel_request",
      "accept_cancel",
      "delivered",
      "revision_request",
      "accept_delivery",
      "reject_cancel",
    ];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({ error: "Invalid actionType" });
    }

    const projectsCollection = db().collection("projects");
    const project = await projectsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Determine new status based on action
    let newStatus = project.status;
    let actionLabel = "";
    let extraUpdate = {};

    switch (actionType) {
      case "cancel_request":
        // If project is already cancelled, block
        if (project.status === "cancelled") {
          return res.status(400).json({
            error: "Project is already cancelled and cannot be modified",
          });
        }
        // If already cancel_pending, block duplicate request
        if (project.status === "cancel_pending") {
          return res
            .status(400)
            .json({ error: "A cancellation request is already pending" });
        }
        newStatus = "cancel_pending";
        actionLabel = "requested cancellation";
        extraUpdate.cancelRequestedBy = senderUid;
        extraUpdate.statusBeforeCancel = project.status;
        break;
      case "accept_cancel":
        // Only the OTHER party (not the one who requested) can accept
        if (project.status !== "cancel_pending") {
          return res
            .status(400)
            .json({ error: "No pending cancellation to accept" });
        }
        if (project.cancelRequestedBy === senderUid) {
          return res
            .status(400)
            .json({ error: "You cannot accept your own cancellation request" });
        }
        newStatus = "cancelled";
        actionLabel = "accepted the cancellation";
        extraUpdate.cancelledAt = new Date().toISOString();

        // Refund reserved reward points back to author
        {
          const usersCollection = db().collection("users");
          const contractsCollection = db().collection("contracts");

          const helpers = project.members.filter((m) => m.role === "helper");
          for (const member of helpers) {
            const reward = Number(member.expectedReward) || 0;
            if (reward > 0) {
              // Release reserved amount (tobereleased) back to available balance
              await usersCollection.updateOne(
                { email: project.owner.email },
                { $inc: { tobereleased: -reward } },
              );
            }
          }

          // Update all contracts for this project to rewardStatus: "refunded"
          await contractsCollection.updateMany(
            { projectId: project._id },
            {
              $set: {
                rewardStatus: "refunded",
                status: "cancelled",
                updatedAt: new Date().toISOString(),
              },
            },
          );
        }
        break;
      case "delivered":
        newStatus = "delivered";
        actionLabel = "marked as delivered";
        break;
      case "revision_request":
        newStatus = "revision_requested";
        actionLabel = "requested a revision";
        break;
      case "accept_delivery":
        newStatus = "completed";
        actionLabel = "accepted the delivery";

        // Transfer reward points: deduct from author, add to helper
        {
          const usersCollection = db().collection("users");
          const contractsCollection = db().collection("contracts");

          // Find all helpers in this project and transfer their rewards
          const helpers = project.members.filter((m) => m.role === "helper");
          for (const member of helpers) {
            const reward = Number(member.expectedReward) || 0;
            if (reward > 0) {
              // Deduct from author balance and release reserved amount
              await usersCollection.updateOne(
                { email: project.owner.email },
                { $inc: { rewardPoints: -reward, tobereleased: -reward } },
              );

              // Add to helper balance
              await usersCollection.updateOne(
                { email: member.email },
                { $inc: { rewardPoints: reward } },
              );
            }
          }

          // Update all contracts for this project to rewardStatus: "released"
          await contractsCollection.updateMany(
            { projectId: project._id },
            {
              $set: {
                rewardStatus: "released",
                status: "completed",
                updatedAt: new Date().toISOString(),
              },
            },
          );
        }
        break;
      case "reject_cancel":
        // Only the OTHER party can reject
        if (project.status !== "cancel_pending") {
          return res
            .status(400)
            .json({ error: "No pending cancellation to reject" });
        }
        if (project.cancelRequestedBy === senderUid) {
          return res
            .status(400)
            .json({ error: "You cannot reject your own cancellation request" });
        }
        newStatus = project.statusBeforeCancel || "in_progress";
        actionLabel = "rejected the cancellation request";
        extraUpdate.cancelRequestedBy = null;
        extraUpdate.statusBeforeCancel = null;
        break;
    }

    // Update project status
    await projectsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...extraUpdate,
        },
      },
    );

    // Sync post status when project is cancelled, delivered, or completed
    const postStatusMap = {
      cancelled: "CANCELLED",
      delivered: "DELIVERED",
      completed: "COMPLETED",
    };
    if (postStatusMap[newStatus] && project.postId) {
      const postsCollection = db().collection("posts");
      await postsCollection.updateOne(
        { _id: project.postId },
        {
          $set: {
            status: postStatusMap[newStatus],
            updatedAt: new Date().toISOString(),
          },
        },
      );
    }

    // Send an action message to the project conversation
    const convId = `project:${req.params.id}`;
    const msgCollection = db().collection("messages");
    const convCollection = db().collection("conversations");

    const actionMessage = {
      conversationId: convId,
      sender: {
        uid: senderUid,
        displayName: senderName || "User",
        photoURL: senderPhoto || null,
      },
      content: message || `${senderName || "User"} ${actionLabel}`,
      type: "action",
      actionType,
      readBy: [senderUid],
      createdAt: new Date().toISOString(),
    };

    await msgCollection.insertOne(actionMessage);

    // Update conversation lastMessage
    await convCollection.updateOne(
      { conversationId: convId },
      {
        $set: {
          lastMessage: {
            content: `Action: ${actionType}`,
            createdAt: actionMessage.createdAt,
            senderUid,
          },
          updatedAt: actionMessage.createdAt,
        },
      },
    );

    res.json({ message: "Action processed", newStatus, actionMessage });
  } catch (err) {
    console.error("POST /projects/:id/action error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /projects/:id/upload - Handle file upload (base64 storage for simplicity)
router.post("/:id/upload", async (req, res) => {
  try {
    const { fileName, fileData, fileSize, senderUid, senderName, senderPhoto } =
      req.body;

    if (!fileName || !fileData || !senderUid) {
      return res
        .status(400)
        .json({ error: "fileName, fileData, and senderUid are required" });
    }

    const projectsCollection = db().collection("projects");
    const project = await projectsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Store file reference in project
    const fileDoc = {
      fileName,
      fileData,
      fileSize: fileSize || 0,
      uploadedBy: senderUid,
      uploadedAt: new Date().toISOString(),
    };

    await projectsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $push: { files: fileDoc },
        $set: { updatedAt: new Date().toISOString() },
      },
    );

    // Send a file message to project chat
    const convId = `project:${req.params.id}`;
    const msgCollection = db().collection("messages");
    const convCollection = db().collection("conversations");

    const fileMessage = {
      conversationId: convId,
      sender: {
        uid: senderUid,
        displayName: senderName || "User",
        photoURL: senderPhoto || null,
      },
      content: `Shared a file: ${fileName}`,
      type: "file",
      fileUrl: fileData,
      fileName,
      fileSize: fileSize || 0,
      readBy: [senderUid],
      createdAt: new Date().toISOString(),
    };

    const result = await msgCollection.insertOne(fileMessage);
    fileMessage._id = result.insertedId;

    await convCollection.updateOne(
      { conversationId: convId },
      {
        $set: {
          lastMessage: {
            content: `Shared a file: ${fileName}`,
            createdAt: fileMessage.createdAt,
            senderUid,
          },
          updatedAt: fileMessage.createdAt,
        },
      },
    );

    res.json({
      message: "File uploaded and shared",
      file: fileDoc,
      chatMessage: fileMessage,
    });
  } catch (err) {
    console.error("POST /projects/:id/upload error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

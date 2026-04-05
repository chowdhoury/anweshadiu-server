const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

const db = () => client.db("anwesha");

// Helper: build a deterministic conversation ID from two UIDs
const buildConvId = (uid1, uid2) => {
  const sorted = [uid1, uid2].sort();
  return `dm:${sorted[0]}_${sorted[1]}`;
};

// ─── POST /conversations  ── Find or create a DM conversation ───
router.post("/", async (req, res) => {
  try {
    const {
      myUid,
      myName,
      myPhoto,
      myEmail,
      otherUid,
      otherName,
      otherPhoto,
      otherEmail,
    } = req.body;

    if (!myUid || !otherUid) {
      return res.status(400).json({ error: "myUid and otherUid are required" });
    }

    if (myUid === otherUid) {
      return res.status(400).json({ error: "Cannot message yourself" });
    }

    const conversationId = buildConvId(myUid, otherUid);
    const convCollection = db().collection("conversations");

    // Try to find existing
    let conv = await convCollection.findOne({ conversationId });

    if (!conv) {
      // Create new conversation
      conv = {
        conversationId,
        participants: [
          {
            uid: myUid,
            displayName: myName || "User",
            photoURL: myPhoto || null,
            email: myEmail || null,
          },
          {
            uid: otherUid,
            displayName: otherName || "User",
            photoURL: otherPhoto || null,
            email: otherEmail || null,
          },
        ],
        lastMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await convCollection.insertOne(conv);
    }

    res.json({ conversationId: conv.conversationId, isNew: !conv._id });
  } catch (err) {
    console.error("POST /conversations error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /conversations?uid=xxx  ── List all conversations for a user ───
router.get("/", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid)
      return res.status(400).json({ error: "uid query param required" });

    const convCollection = db().collection("conversations");
    const convs = await convCollection
      .find({
        "participants.uid": uid,
        conversationId: { $not: /^project:/ },
      })
      .sort({ updatedAt: -1 })
      .toArray();

    // Transform: attach otherParty info and unread count
    const msgCollection = db().collection("messages");

    const result = await Promise.all(
      convs.map(async (conv) => {
        const otherParty =
          conv.participants.find((p) => p.uid !== uid) || conv.participants[0];
        const unreadCount = await msgCollection.countDocuments({
          conversationId: conv.conversationId,
          "sender.uid": { $ne: uid },
          readBy: { $nin: [uid] },
        });
        return {
          conversationId: conv.conversationId,
          otherParty,
          lastMessage: conv.lastMessage,
          unreadCount,
          updatedAt: conv.updatedAt,
        };
      }),
    );

    res.json(result);
  } catch (err) {
    console.error("GET /conversations error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /conversations/project  ── Find or create a project conversation ───
router.post("/project", async (req, res) => {
  try {
    const { projectId, participants } = req.body;

    if (!projectId || !participants || participants.length < 2) {
      return res
        .status(400)
        .json({ error: "projectId and at least 2 participants are required" });
    }

    const conversationId = `project:${projectId}`;
    const convCollection = db().collection("conversations");

    let conv = await convCollection.findOne({ conversationId });

    if (!conv) {
      conv = {
        conversationId,
        projectId,
        type: "project",
        participants: participants.map((p) => ({
          uid: p.uid,
          displayName: p.displayName || "User",
          photoURL: p.photoURL || null,
          email: p.email || null,
          role: p.role || "member",
        })),
        lastMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await convCollection.insertOne(conv);
    }

    res.json({ conversationId: conv.conversationId, isNew: !conv._id });
  } catch (err) {
    console.error("POST /conversations/project error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /conversations/:convId/messages  ── Get messages ───
router.get("/:convId/messages", async (req, res) => {
  try {
    const { convId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const msgCollection = db().collection("messages");
    const messages = await msgCollection
      .find({ conversationId: convId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();

    res.json(messages);
  } catch (err) {
    console.error("GET messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /conversations/:convId/messages  ── Send a message ───
router.post("/:convId/messages", async (req, res) => {
  try {
    const { convId } = req.params;
    const {
      senderUid,
      senderName,
      senderPhoto,
      content,
      type,
      fileUrl,
      fileName,
      fileSize,
      actionType,
    } = req.body;

    if (!senderUid) {
      return res.status(400).json({ error: "senderUid is required" });
    }

    const msgType = type || "text";

    if (msgType === "text" && !content) {
      return res
        .status(400)
        .json({ error: "content is required for text messages" });
    }
    if (msgType === "file" && !fileUrl) {
      return res
        .status(400)
        .json({ error: "fileUrl is required for file messages" });
    }
    if (msgType === "action" && !actionType) {
      return res
        .status(400)
        .json({ error: "actionType is required for action messages" });
    }

    const msgCollection = db().collection("messages");
    const convCollection = db().collection("conversations");

    const message = {
      conversationId: convId,
      sender: {
        uid: senderUid,
        displayName: senderName || "User",
        photoURL: senderPhoto || null,
      },
      content: content ? content.trim() : "",
      type: msgType,
      readBy: [senderUid],
      createdAt: new Date().toISOString(),
    };

    if (msgType === "file") {
      message.fileUrl = fileUrl;
      message.fileName = fileName || "file";
      message.fileSize = fileSize || 0;
    }

    if (msgType === "action") {
      message.actionType = actionType;
    }

    const result = await msgCollection.insertOne(message);
    message._id = result.insertedId;

    // Update conversation's lastMessage and updatedAt
    await convCollection.updateOne(
      { conversationId: convId },
      {
        $set: {
          lastMessage: {
            content:
              msgType === "action"
                ? `Action: ${actionType}`
                : msgType === "file"
                  ? `Shared a file: ${message.fileName}`
                  : message.content,
            createdAt: message.createdAt,
            senderUid,
          },
          updatedAt: message.createdAt,
        },
      },
    );

    res.json(message);
  } catch (err) {
    console.error("POST message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PATCH /conversations/:convId/read  ── Mark messages as read ───
router.patch("/:convId/read", async (req, res) => {
  try {
    const { convId } = req.params;
    const { uid } = req.body;

    if (!uid) return res.status(400).json({ error: "uid is required" });

    const msgCollection = db().collection("messages");
    await msgCollection.updateMany(
      { conversationId: convId, readBy: { $nin: [uid] } },
      { $addToSet: { readBy: uid } },
    );

    res.json({ success: true });
  } catch (err) {
    console.error("PATCH read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

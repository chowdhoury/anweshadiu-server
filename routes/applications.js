const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

// POST - Submit an application for a request
router.post("/", async (req, res) => {
  const applicationsCollection = client
    .db("anwesha")
    .collection("applications");
  const postsCollection = client.db("anwesha").collection("posts");

  const {
    postId,
    proposedDeadline,
    expectedReward,
    skills,
    coverMessage,
    applicant,
  } = req.body;

  if (!postId || !proposedDeadline || !expectedReward || !skills?.length) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  const application = {
    postId: new ObjectId(postId),
    proposedDeadline,
    expectedReward: Number(expectedReward),
    skills,
    coverMessage: coverMessage || "",
    applicant,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const result = await applicationsCollection.insertOne(application);

  // Increment applicantsCount on the post
  await postsCollection.updateOne(
    { _id: new ObjectId(postId) },
    { $inc: { applicantsCount: 1 } },
  );

  res.send({ message: "Application submitted successfully", result });
});

// GET - Get all applications for a specific post
router.get("/post/:postId", async (req, res) => {
  const applicationsCollection = client
    .db("anwesha")
    .collection("applications");
  const applications = await applicationsCollection
    .find({ postId: new ObjectId(req.params.postId) })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(applications);
});

// GET - Get all applications by a specific user (with post details)
router.get("/user/:email", async (req, res) => {
  const applicationsCollection = client
    .db("anwesha")
    .collection("applications");
  const applications = await applicationsCollection
    .aggregate([
      { $match: { "applicant.email": req.params.email } },
      {
        $lookup: {
          from: "posts",
          localField: "postId",
          foreignField: "_id",
          as: "post",
        },
      },
      { $unwind: { path: "$post", preserveNullAndEmptyArrays: true } },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();
  res.send(applications);
});

// GET - Get all applications for posts owned by a specific user
router.get("/owner/:email", async (req, res) => {
  const applicationsCollection = client
    .db("anwesha")
    .collection("applications");
  const applications = await applicationsCollection
    .aggregate([
      {
        $lookup: {
          from: "posts",
          localField: "postId",
          foreignField: "_id",
          as: "post",
        },
      },
      { $unwind: { path: "$post", preserveNullAndEmptyArrays: false } },
      { $match: { "post.author.email": req.params.email } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          postId: 1,
          proposedDeadline: 1,
          expectedReward: 1,
          skills: 1,
          coverMessage: 1,
          applicant: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ])
    .toArray();
  res.send(applications);
});

// PATCH - Update application status (withdraw, accept, reject)
router.patch("/:id", async (req, res) => {
  const applicationsCollection = client
    .db("anwesha")
    .collection("applications");
  const postsCollection = client.db("anwesha").collection("posts");
  const { status } = req.body;
  const result = await applicationsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status, updatedAt: new Date().toISOString() } },
  );

  // When an application is accepted, update the post status to INPROCESS
  if (status === "accepted") {
    const application = await applicationsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (application) {
      await postsCollection.updateOne(
        { _id: application.postId },
        {
          $set: { status: "IN_PROGRESS", updatedAt: new Date().toISOString() },
        },
      );
    }
  }

  res.send({ message: "Application updated successfully", result });
});

router.get("/", async (req, res) => {
  const applicationsCollection = client
    .db("anwesha")
    .collection("applications");
  const applications = await applicationsCollection.find({}).toArray();
  res.send(applications);
});

module.exports = router;

const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

router.get("/", async (req, res) => {
  const postsCollection = client.db("anwesha").collection("posts");
  const { user } = req.query;
  const filter = user ? { "author.email": user } : { status: "OPEN" };

  const posts = await postsCollection
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  res.send(posts);
});

router.get("/:postId", async (req, res, next) => {
  const postId = req.params.postId;
  // If it's not a MongoDB ObjectId, let the next matching route handle it.
  if (!ObjectId.isValid(postId)) {
    return next();
  }
  const postsCollection = client.db("anwesha").collection("posts");
  const post = await postsCollection.findOne({ _id: new ObjectId(postId) });
  if (!post) {
    return res.status(404).send({ message: "Post not found" });
  }
  res.send(post);
});

router.post("/", async (req, res) => {
  const post = req.body;
  const postsCollection = client.db("anwesha").collection("posts");
  const result = await postsCollection.insertOne(post);
  res.send({ message: "Post created successfully", result });
});

router.patch("/:postId", async (req, res) => {
  const postId = req.params.postId;
  const postsCollection = client.db("anwesha").collection("posts");
  const filter = { _id: new ObjectId(postId) };
  const updatedPost = req.body;
  const updateDoc = {
    $set: updatedPost,
  };
  const result = await postsCollection.updateOne(filter, updateDoc);
  res.send({ message: "Post updated successfully", result });
});

router.delete("/:postId", async (req, res) => {
  const postId = req.params.postId;
  const postsCollection = client.db("anwesha").collection("posts");
  const filter = { _id: new ObjectId(postId) };
  const result = await postsCollection.deleteOne(filter);
  res.send({ message: "Post deleted successfully", result });
});

module.exports = router;

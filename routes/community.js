const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

router.get("/", async (req, res) => {
  const communityCollection = client.db("anwesha").collection("community");
  const { author } = req.query;
  const filter = {};

  if (author) {
    filter["author.email"] = author;
    filter["metadata.status"] = { $ne: "deleted" };
  } else {
    filter["metadata.status"] = "published";
  }

  const community = await communityCollection
    .find(filter)
    .sort({ "metadata.createdAt": -1 })
    .toArray();
  res.send(community);
});

router.get("/:id", async (req, res) => {
  const communityId = req.params.id;
  const communityCollection = client.db("anwesha").collection("community");
  const community = await communityCollection.findOne({
    _id: new ObjectId(communityId),
  });
  res.send(community);
});

router.post("/", async (req, res) => {
  const community = req.body;
  const communityCollection = client.db("anwesha").collection("community");
  const result = await communityCollection.insertOne(community);
  res.send({ message: "Community created successfully", result });
});

router.patch("/:id", async (req, res) => {
  const communityId = req.params.id;
  const communityCollection = client.db("anwesha").collection("community");
  const filter = { _id: new ObjectId(communityId) };
  const updatedCommunity = req.body;
  const updateDoc = {
    $set: updatedCommunity,
  };
  const result = await communityCollection.updateOne(filter, updateDoc);
  res.send({ message: "Community updated successfully", result });
});

router.delete("/:id", async (req, res) => {
  const communityId = req.params.id;
  const communityCollection = client.db("anwesha").collection("community");
  const filter = { _id: new ObjectId(communityId) };
  const updateDoc = {
    $set: { "metadata.status": "deleted" },
  };
  const result = await communityCollection.updateOne(filter, updateDoc);
  res.send({ message: "Community deleted successfully", result });
});

module.exports = router;

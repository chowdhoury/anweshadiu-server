const express = require("express");
const router = express.Router();
const { client } = require("../db");
const { ObjectId } = require("mongodb");

router.get("/", async (req, res) => {
  const skillsCollection = client.db("anwesha").collection("skills");
  const { seller } = req.query;
  const filter = {};

  if (seller) {
    filter["seller.email"] = seller;
    filter.status = { $ne: "deleted" };
  } else {
    filter.status = "published";
  }

  const skills = await skillsCollection
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  res.send(skills);
});

router.get("/:id", async (req, res) => {
  const skillId = req.params.id;
  const skillsCollection = client.db("anwesha").collection("skills");
  const skill = await skillsCollection.findOne({ _id: new ObjectId(skillId) });
  res.send(skill);
});

router.post("/", async (req, res) => {
  const skill = req.body;
  const skillsCollection = client.db("anwesha").collection("skills");
  const result = await skillsCollection.insertOne(skill);
  res.send({ message: "Skill added successfully", result });
});

router.patch("/:skillId", async (req, res) => {
  const skillId = req.params.skillId;
  const skillsCollection = client.db("anwesha").collection("skills");
  const filter = { _id: new ObjectId(skillId) };
  const updatedSkill = req.body;
  const updateDoc = {
    $set: updatedSkill,
  };
  const result = await skillsCollection.updateOne(filter, updateDoc);
  res.send({ message: "Skill updated successfully", result });
});

router.delete("/:skillId", async (req, res) => {
  const skillId = req.params.skillId;
  const skillsCollection = client.db("anwesha").collection("skills");
  const filter = { _id: new ObjectId(skillId) };
  const updateDoc = {
    $set: { status: "deleted" },
  };
  const result = await skillsCollection.updateOne(filter, updateDoc);
  res.send({ message: "Skill deleted successfully", result });
});

module.exports = router;

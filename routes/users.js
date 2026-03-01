const express = require("express");
const router = express.Router();
const { client } = require("../db");

router.get("/", async (req, res) => {
  const usersCollection = client.db("anwesha").collection("users");
  const users = await usersCollection.find({}).toArray();
  res.send(users);
});

router.post("/", async (req, res) => {
  const user = req.body;
  const usersCollection = client.db("anwesha").collection("users");
  const isExisting = await usersCollection.findOne({ email: user.email });
  if (isExisting) {
    return res.send({ message: "User already exists" });
  }
  const result = await usersCollection.insertOne(user);
  res.send({ message: "User created successfully", result });
});

router.patch("/:userEmail", async (req, res) => {
  const userEmail = req.params.userEmail;
  const usersCollection = client.db("anwesha").collection("users");
  const filter = { email: userEmail };
  const updatedUser = req.body;
  const updateDoc = {
    $set: updatedUser,
  };
  const result = await usersCollection.updateOne(filter, updateDoc);
  res.send({ message: "User updated successfully", result });
});

module.exports = router;

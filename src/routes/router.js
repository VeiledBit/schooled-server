const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");
const hcaptcha = require("../middlewares/hCaptcha");

module.exports = function (io) {
  router.get("/usersInfo", roomController.getAllUsers);
  router.post("/createRoom", hcaptcha, roomController.createRoom);
  router.post("/joinRoom", (req, res) => {
    roomController.joinRoom(req, res, io)
  });

  return router;
};

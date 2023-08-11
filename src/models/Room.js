const mongoose = require("mongoose");
const { User } = require(__dirname + "/User.js").schema;

const RoomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
    },
    users: {
      type: [User],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", RoomSchema);

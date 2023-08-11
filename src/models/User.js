const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
    },
    username: {
      type: String,
    },
    failCount: {
      type: Number,
      default: 0,
      max: 12,
    },
    isRoomMaster: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);

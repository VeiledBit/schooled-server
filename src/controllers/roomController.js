const Room = require("../models/Room");
const User = require("../models/User");
const { generateString } = require("../util/room");

const getAllUsers = async (req, res) => {
  const roomCode = req.query.roomCode;
  try {
    const room = await Room.findOne({ roomCode: roomCode });
    if (room === null) res.sendStatus(403);
    res.status(200).json(room.users);
  } catch (error) {
    res.status(500).json(error);
  }
};

const createRoom = async (req, res) => {
  const roomCode = generateString(6);
  const username = req.body.username;
  const isRoomMasterParticipating = req.body.isRoomMasterParticipating;
  const newRoom = new Room({ roomCode: roomCode });
  let userId;

  if (isRoomMasterParticipating) {
    userId = newRoom.users.length + 1;
  } else {
    userId = newRoom.users.length;
  }

  const user = new User({
    userId: userId,
    username: username,
    isRoomMaster: true,
  });

  newRoom.users.push(user);

  try {
    const savedRoom = await newRoom.save();
    res.status(200).json(savedRoom);
  } catch (error) {
    res.status(500).json(error);
  }
};

const joinRoom = async (req, res, io) => {
  const roomCode = req.body.roomCode;
  const username = req.body.username;

  try {
    const room = await Room.findOne({ roomCode: roomCode });

    if (room === null) {
      res.sendStatus(404);
      return;
    }

    for (let i = 0; i < room.users.length; i++) {
      const user = room.users[i];
      if (user.username === username) {
        res.sendStatus(409);
        return;
      }
    }
    let userId;

    if (room.users[0].userId === 0) {
      userId = room.users.length;
    } else {
      userId = room.users.length + 1;
    }

    const user = new User({ userId: userId, username: username });
    room.users.push(user);
    room.save();
    io.to(roomCode).emit("user-join", {
      users: room.users,
    });

    // req.users = room.users; // Pass users array for io.emit inside router.js
    res.sendStatus(200);
  } catch (error) {
    res.status(500).json(error);
  }
};

module.exports = {
  getAllUsers,
  createRoom,
  joinRoom,
};

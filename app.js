const express = require("express");
const app = express();
const server = require("http").createServer(app);
const mongoose = require("mongoose");
const cors = require("cors");
const { verify } = require("hcaptcha");
const dotenv = require("dotenv");
const Room = require("./models/Room");
const User = require("./models/User");
const Question = require("./models/Question");
const { deletionTask } = require("./cron");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const rateLimit = require("express-rate-limit");


const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 15, // requests per windowMs
});


app.use(cors());
app.use(express.json());
app.use(limiter);
dotenv.config();

io.on("connection", function (socket) {
  console.log(socket.id);

  socket.on("join-room", async (data, callback) => {
    const roomCode = data.roomCode;
    const username = data.username;
    if (roomCode !== null && username !== null) {
      const room = await Room.findOne({ roomCode: roomCode });
      if (room === null) {
        return;
      }
      socket.join(roomCode);
      if (room.users.length > 0) {
        for (let i = 0; i < room.users.length; i++) {
          const user = room.users[i];
          if (user.username === username) {
            callback(user.isRoomMaster);
            return;
          }
        }
      } else {
        callback(false);
      }
    } else {
      return;
    }
  });

  socket.on(
    "get-question",
    async (roomCode, questionGrade, questionCategory) => {
      const room = await Room.findOne({ roomCode: roomCode });
      if (room === null) {
        return;
      }
      const questions = await Question.find({
        grade: questionGrade,
        category: questionCategory,
      });
      const randQuestion = questions[getRandomInt(questions.length)];
      const questionValue = randQuestion.question;
      const answerValue = randQuestion.answer;
      io.to(roomCode).emit("question", questionValue, answerValue);
    }
  );

  socket.on("commence-reveal", (roomCode) => {
    io.to(roomCode).emit("request-canvas-data");
  });

  socket.on("update-timer", (roomCode, newTimerMinutes, newTimerSeconds) => {
    io.to(roomCode).emit(
      "update-timer-response",
      newTimerMinutes,
      newTimerSeconds
    );
  });

  socket.on("canvas-data", async (roomCode, username, canvasData) => {
    let id;
    const room = await Room.findOne({ roomCode: roomCode });
    if (room === null) {
      return;
    }
    room.users.forEach((element) => {
      if (element.username === username) {
        id = element.userId;
      }
    });
    io.to(roomCode).emit("canvas-receive", { id: id, canvasData: canvasData });
  });

  socket.on("increment-fails", async (roomCode, userId) => {
    const room = await Room.findOne({ roomCode: roomCode });
    if (room === null) {
      return;
    }
    let count;
    for (let i = 0; i < room.users.length; i++) {
      const user = room.users[i];
      if (user.userId == userId) {
        if (user.failCount === 3) {
          continue;
        } else {
          user.failCount++;
          count = user.failCount;
          break;
        }
      }
    }
    room.markModified("users");
    await room.save();
    io.to(roomCode).emit("confirm-increment", {
      userId: userId,
      currentCount: count,
    });
  });

  socket.on("decrement-fails", async (roomCode, userId) => {
    const room = await Room.findOne({ roomCode: roomCode });
    if (room === null) {
      return;
    }
    let count;
    for (let i = 0; i < room.users.length; i++) {
      const user = room.users[i];
      if (user.userId == userId) {
        if (user.failCount === 0) {
          continue;
        } else {
          user.failCount--;
          count = user.failCount;
          break;
        }
      }
    }
    room.markModified("users");
    await room.save();
    io.to(roomCode).emit("confirm-decrement", {
      userId: userId,
      currentCount: count,
    });
  });

  socket.on("leave-room", async (roomCode, username) => {
    const room = await Room.findOne({ roomCode: roomCode });
    if (room === null) {
      return;
    }
    for (let i = 0; i < room.users.length; i++) {
      const user = room.users[i];
      if (user.username === username) {
        room.users.splice(i, 1);
      }
    }
    room.markModified("users");
    await room.save();
  });

  socket.on("answer-locked-in", async (roomCode, username) => {
    const room = await Room.findOne({ roomCode: roomCode });
    if (room === null) {
      return;
    }
    let userOrderNumber = null;
    for (let i = 0; i < room.users.length; i++) {
      const user = room.users[i];
      if (user.username === username) {
        if (room.users[0].userId === 0) {
          userOrderNumber = i;
        } else {
          userOrderNumber = i + 1;
        }
      }
    }
    io.to(roomCode).emit("answer-locked-in-response", {
      userOrder: userOrderNumber,
    });
  });
});

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const port = 3001;

const characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

mongoose.connect(process.env.MONGO_URL, { useUnifiedTopology: true }, () => {
  console.log("Connected to MongoDB");
});

function generateString(length) {
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

app.post("/createRoom", async (req, res) => {
  const roomCode = generateString(6);
  const username = req.body.username;
  const isRoomMasterParticipating = req.body.isRoomMasterParticipating;
  const captchaToken = req.body.captchaToken;
  if (process.env.HCAPTCHA === "true") {
    verify(process.env.HCAPTCHA_SECRET, captchaToken)
      .then(async (data) => {
        if (data.success === true) {
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
          } catch (err) {
            res.status(500).json(err);
          }
        } else {
          res.sendStatus(403);
        }
      })
      .catch(console.error);
  } else {
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
    } catch (err) {
      res.status(500).json(err);
    }
  }
});

app.post("/joinRoom", async (req, res) => {
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
    let userOrderNumber;
    for (let i = 0; i < room.users.length; i++) {
      const user = room.users[i];
      if (user.username === username) {
        if (room.users[0].userId === 0) {
          userOrderNumber = i;
        } else {
          userOrderNumber = i + 1;
        }
      }
    }
    io.to(roomCode).emit("user-join", {
      userOrder: userOrderNumber,
      username: username,
    });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get("/usersInfo", async (req, res) => {
  const roomCode = req.query.roomCode;
  try {
    const room = await Room.findOne({ roomCode: roomCode });
    if (room === null) {
      return;
    }
    res.status(200).json(room.users);
  } catch (err) {
    res.status(500).json(err);
  }
});

if (process.env.SCALING === "true") {
  console.log("Creating Redis adapter");
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
  });
}

server.listen(port, async () => {
  console.log(`Listening at http://localhost:${port}`);
  deletionTask.start();
});

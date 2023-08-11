const socketIO = require("socket.io");
const Room = require("../models/Room");
const Question = require("../models/Question");
const { getRandomInt } = require("../util/room");

const initializeSocket = (server) => {
  const io = socketIO(server, {
    cocors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
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
      io.to(roomCode).emit("canvas-receive", {
        id: id,
        canvasData: canvasData,
      });
    });

    socket.on("increment-fails", async (roomCode, userId) => {
      const room = await Room.findOne({ roomCode: roomCode });
      if (room === null) {
        return;
      }
      for (let i = 0; i < room.users.length; i++) {
        const user = room.users[i];
        if (user.userId == userId) {
          if (user.failCount === 3) {
            continue;
          } else {
            user.failCount++;
            break;
          }
        }
      }
      room.markModified("users");
      await room.save();
      io.to(roomCode).emit("confirm-increment", {
        users: room.users,
      });
    });

    socket.on("decrement-fails", async (roomCode, userId) => {
      const room = await Room.findOne({ roomCode: roomCode });
      if (room === null) {
        return;
      }
      for (let i = 0; i < room.users.length; i++) {
        const user = room.users[i];
        if (user.userId == userId) {
          if (user.failCount === 0) {
            continue;
          } else {
            user.failCount--;
            break;
          }
        }
      }
      room.markModified("users");
      await room.save();
      io.to(roomCode).emit("confirm-decrement", {
        users: room.users,
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

  return io;
};

module.exports = initializeSocket;

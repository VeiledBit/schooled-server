const cron = require("node-cron");
const Room = require("./models/Room");

const deletionTask = cron.schedule(
  "*/30 * * * *",
  async () => {
    try {
      const room = await Room.find({});
      room.forEach((el) => {
        const timeDifference = (Date.now() - el.updatedAt) / (1000 * 60);
        if (Math.floor(timeDifference) > 60) {
          Room.deleteOne({ roomCode: el.roomCode })
            .then(function () {
              console.log(`Deleting: ${el.roomCode}`);
            })
            .catch(function (error) {
              console.log("Error occured during deletion.");
            });
        }
      });
    } catch (err) {
      res.status(500).json(err);
    }
  },
  {
    scheduled: false,
  }
);

module.exports = {
  deletionTask,
};

const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

function initializeRedis(io) {
  if (process.env.SCALING === "true") {
    console.log("Creating Redis adapter");
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
    });
  }
}

module.exports = initializeRedis;

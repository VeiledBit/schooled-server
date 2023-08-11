const express = require("express");
const app = express();
const server = require("http").createServer(app);
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const router = require("./src/routes/router");
const hcaptchaMiddleWare = require("./src/middlewares/hCaptcha");
const initializeSocket = require("./src/config/socket");
const initializeRedis = require("./src/config/redis");
const deletionTask = require("./src/util/cron");
require("./src/config/mongodb");
require("dotenv").config();

const io = initializeSocket(server);
initializeRedis(io);

app.use(cors());
app.use(express.json());
app.use("/", router(io));
app.use(hcaptchaMiddleWare);

const rateLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 15, // requests per windowMs
});
app.use(rateLimiter);

server.listen(process.env.PORT, async () => {
  console.log(`Listening at http://localhost:${process.env.PORT}`);
  deletionTask.start();
});

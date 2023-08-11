const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URL, { useUnifiedTopology: true });

const db = mongoose.connection;

db.on("error", (error) => {
  console.error("MongoDB connection error: ", error);
});

db.once("open", () => {
  console.log("Connected to MongoDB");
});

module.exports = mongoose;

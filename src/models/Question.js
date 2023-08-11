const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
    },
    category: {
      type: String,
    },
    question: {
      type: String,
    },
    answer: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", QuestionSchema);

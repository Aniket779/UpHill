const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    status: { type: String, enum: ['done', 'missed'], required: true },
  },
  { _id: false }
);

const habitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  logs: [logSchema],
});

module.exports = mongoose.model('Habit', habitSchema);

const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  target: {
    type: Number,
    min: 1,
    default: 100,
  },
  progress: {
    type: Number,
    min: 0,
    default: 0,
  },
  weekStartDate: { type: String, required: true },
  taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  habitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Habit' }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Goal', goalSchema);

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  date: { type: String, required: true },
  startTime: { type: String, default: null },
  duration: { type: Number, default: null },
  status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
  category: { type: String, default: 'general', trim: true },
  tags: [{ type: String, trim: true }],
  goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },
});

module.exports = mongoose.model('Task', taskSchema);

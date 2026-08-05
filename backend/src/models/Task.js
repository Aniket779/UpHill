const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
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
  recurrence: {
    active: { type: Boolean, default: false },
    daysOfWeek: { type: [Number], default: [] },
    until: { type: String, default: null },
  },
  recurringParentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
});

module.exports = mongoose.model('Task', taskSchema);

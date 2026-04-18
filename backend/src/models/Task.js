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
  category: { type: String, default: 'general', trim: true },
  tags: [{ type: String, trim: true }],
  goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },
});

module.exports = mongoose.model('Task', taskSchema);

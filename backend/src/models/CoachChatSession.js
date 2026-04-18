const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const coachChatSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  messages: [messageSchema],
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CoachChatSession', coachChatSessionSchema);

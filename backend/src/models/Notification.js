const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Using string to match other models if they use string, or ObjectId if preferred.
  type: { 
    type: String, 
    enum: ['goal_missed', 'streak_at_risk', 'inactivity', 'milestone', 'system'],
    required: true 
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dismissed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // Optional: notifications could auto-expire
});

module.exports = mongoose.model('Notification', notificationSchema);

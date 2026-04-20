const express = require('express');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const Habit = require('../models/Habit');
const Goal = require('../models/Goal');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Helper to get today's date string YYYY-MM-DD
function getTodayYmd() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

async function analyzeAndGenerate(userId) {
  const today = getTodayYmd();
  const notifications = [];

  // 1. Check for skipped goals
  // If there are goals for this week but progress is low and no tasks completed today
  const goals = await Goal.find().lean();
  const todayTasks = await Task.find({ date: today }).lean();
  const completedToday = todayTasks.filter(t => t.completed).length;

  if (goals.length > 0 && completedToday === 0) {
    const mainGoal = goals[0]; // Assuming first one is primary for simplicity
    notifications.push({
      type: 'goal_missed',
      title: 'Goal Focus Needed',
      message: `You haven't made progress on "${mainGoal.title}" today. Every day counts!`,
      priority: 'high'
    });
  }
  
  // 2. Check for high priority tasks
  const highPriorityOpen = todayTasks.filter(t => t.priority === 'high' && !t.completed);
  if (highPriorityOpen.length > 0 && completedToday > 0) {
    notifications.push({
      type: 'goal_missed',
      title: 'High Priority Alert',
      message: `You have ${highPriorityOpen.length} high-priority tasks still open. Tackle them next?`,
      priority: 'medium'
    });
  }

  // 3. Check for habits/streaks at risk
  const habits = await Habit.find().lean();
  for (const habit of habits) {
    const todayLog = (habit.logs || []).find(l => l.date === today);
    if (!todayLog && habit.streak > 0) {
      notifications.push({
        type: 'streak_at_risk',
        title: 'Streak at Risk',
        message: `Your ${habit.streak}-day streak for "${habit.name}" is about to break!`,
        priority: 'high'
      });
    }
  }

  // 4. Inactivity check (simplified)
  if (todayTasks.length === 0) {
    notifications.push({
      type: 'inactivity',
      title: 'Plan Your Day',
      message: "You haven't added any tasks for today yet. Start with one small win!",
      priority: 'low'
    });
  }

  // Save new ones only if they don't exist for today already
  for (const n of notifications) {
    const exists = await Notification.findOne({
      userId,
      type: n.type,
      createdAt: { $gte: new Date(today) }
    });

    if (!exists) {
      await Notification.create({ ...n, userId });
    }
  }
}

// GET /notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    // Trigger analysis
    await analyzeAndGenerate(userId);

    const list = await Notification.find({ userId, dismissed: false })
      .sort({ createdAt: -1 })
      .limit(10);
      
    res.json(list);
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /notifications/:id/dismiss
router.post('/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { dismissed: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});

module.exports = router;

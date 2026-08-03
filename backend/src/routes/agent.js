const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Task = require('../models/Task');
const Habit = require('../models/Habit');

const router = express.Router();
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';

function todayLocalString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

router.post('/analyze-day', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured.' });
  }

  const { localTime } = req.body;
  const dateStr = todayLocalString();

  try {
    const tasks = await Task.find({ userId: req.user.sub, date: dateStr }).lean();
    const pendingTasks = tasks.filter(t => !t.completed);
    
    // If they have no pending tasks, they are done for the day!
    if (pendingTasks.length === 0) {
      return res.json({
        suggestion: "You have completed all your tasks for today. Great job! Take some time to rest or plan for tomorrow.",
        actionable: false
      });
    }

    const payload = {
      localTime: localTime || new Date().toLocaleTimeString(),
      pendingTasks: pendingTasks.map(t => ({ id: t._id, title: t.title, priority: t.priority })),
      completedCount: tasks.filter(t => t.completed).length,
      totalCount: tasks.length
    };

    const prompt = `You are an intelligent, proactive productivity agent. Analyze the user's current day state.
    
Data:
${JSON.stringify(payload, null, 2)}

Task: Provide exactly ONE sharp, actionable suggestion based on the time of day and pending tasks.
For example, if it's late and there are many high priority tasks, suggest moving one to tomorrow.
If they are doing great, suggest tackling the hardest task next.

Respond with ONLY valid JSON in exactly this shape:
{
  "suggestion": "Your message to the user",
  "actionable": true,
  "suggestedTaskId": "id_of_task_to_action_on_if_applicable",
  "suggestedAction": "reschedule_tomorrow" 
}
(suggestedAction can be 'reschedule_tomorrow', 'mark_done', or 'none').`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });
    const result = await model.generateContent(prompt);
    
    let text = typeof result.response?.text === 'function' ? result.response.text().trim() : '';
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    
    const parsed = JSON.parse(text);
    return res.json(parsed);

  } catch (err) {
    console.error('Agent analysis error:', err);
    return res.status(500).json({ error: 'Failed to generate agent analysis.' });
  }
});

module.exports = router;

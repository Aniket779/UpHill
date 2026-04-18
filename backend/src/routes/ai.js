const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();

const MODEL_ID = 'gemini-3.1-flash-lite-preview';

function normalizeHabits(v) {
  return Array.isArray(v) ? v : [];
}

/** Supports number or array length (existing clients may send task arrays). */
function asNonNegativeCount(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  if (Array.isArray(v)) {
    return v.length;
  }
  return 0;
}

router.post('/feedback', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return res.status(503).json({
      error: 'AI feedback is not configured. Set GEMINI_API_KEY on the server.',
    });
  }

  const body = req.body ?? {};
  const habits = normalizeHabits(body.habits);
  const tasksCompleted = asNonNegativeCount(body.tasksCompleted);
  const missedTasks = asNonNegativeCount(body.missedTasks);

  const coachInstruction =
    'You are a strict but motivating coach. Analyze the user data and give short actionable feedback.';

  const dataBlock = JSON.stringify(
    {
      habits,
      tasksCompleted,
      missedTasks,
    },
    null,
    2
  );

  const prompt = `${coachInstruction}\n\nUser data (JSON):\n${dataBlock}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const feedback = typeof response.text === 'function' ? response.text().trim() : '';

    if (!feedback) {
      return res.status(502).json({ error: 'The model returned an empty message.' });
    }

    return res.json({ feedback });
  } catch (err) {
    console.error('AI feedback error:', err);
    return res.status(500).json({
      error: 'Failed to generate feedback.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

module.exports = router;

const express = require('express');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const CoachChatSession = require('../models/CoachChatSession');

const router = express.Router();

const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';

const CHAT_SYSTEM = `You are a strict, disciplined performance coach.
Rules:
- No soft motivational talk, empty affirmations, or toxic positivity.
- Be candid and specific. Demand clarity, deadlines, and ownership.
- Focus on action and accountability: what to do next, by when, and how you'll verify it.
- Keep replies concise unless the user asks for depth.
- If they're vague or making excuses, name it and redirect to concrete commitments.`;

function normalizeHabits(v) {
  return Array.isArray(v) ? v : [];
}

function asNonNegativeCount(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.floor(v));
  }
  if (Array.isArray(v)) {
    return v.length;
  }
  return 0;
}

function toGeminiHistory(messages) {
  const out = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    out.push({ role, parts: [{ text: m.content }] });
  }
  return out;
}

/** Gemini chat history must alternate user/model and start with user. */
function sanitizeHistoryForChat(messages) {
  const maxTurns = 24;
  let slice = messages.slice(-maxTurns * 2);
  while (slice.length && slice[0].role !== 'user') {
    slice = slice.slice(1);
  }
  let i = 0;
  while (i < slice.length) {
    const expect = i % 2 === 0 ? 'user' : 'assistant';
    if (slice[i].role !== expect) {
      slice = slice.slice(0, i);
      break;
    }
    i += 1;
  }
  if (slice.length && slice[slice.length - 1].role === 'user') {
    slice = slice.slice(0, -1);
  }
  return slice;
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

router.get('/chat', async (req, res) => {
  const sid = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
  if (!sid || sid.length < 8) {
    return res.status(400).json({ error: 'sessionId query parameter is required' });
  }
  try {
    const session = await CoachChatSession.findOne({ sessionId: sid }).lean();
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json({ sessionId: session.sessionId, messages: session.messages });
  } catch (err) {
    console.error('AI chat load error:', err);
    return res.status(500).json({
      error: 'Failed to load chat session.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post('/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return res.status(503).json({
      error: 'AI chat is not configured. Set GEMINI_API_KEY on the server.',
    });
  }

  const rawMessage = req.body?.message ?? req.body?.text;
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  let sessionId =
    typeof req.body?.sessionId === 'string' && req.body.sessionId.trim().length >= 8
      ? req.body.sessionId.trim()
      : null;

  try {
    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    let session = await CoachChatSession.findOne({ sessionId });
    if (!session) {
      session = await CoachChatSession.create({ sessionId, messages: [] });
    }

    const historyMessages = sanitizeHistoryForChat(session.messages);
    const geminiHistory = toGeminiHistory(historyMessages);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: CHAT_SYSTEM,
    });

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(message);
    const reply =
      typeof result.response?.text === 'function' ? result.response.text().trim() : '';

    if (!reply) {
      return res.status(502).json({ error: 'The model returned an empty message.' });
    }

    session.messages.push(
      { role: 'user', content: message, createdAt: new Date() },
      { role: 'assistant', content: reply, createdAt: new Date() }
    );
    if (session.messages.length > 200) {
      session.messages = session.messages.slice(-200);
    }
    session.updatedAt = new Date();
    await session.save();

    return res.json({
      sessionId,
      reply,
      messages: session.messages,
    });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({
      error: 'Failed to generate chat reply.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

module.exports = router;

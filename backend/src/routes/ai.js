const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const CoachChatSession = require('../models/CoachChatSession');
const Feedback = require('../models/Feedback');
const Task = require('../models/Task');
const Habit = require('../models/Habit');

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function last7DayStrings() {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

/**
 * Build a rich, structured data summary for the last 7 days to feed into the prompt.
 */
async function buildFeedbackContext(days) {
  const Goal = require('../models/Goal');
  const [tasks, habits, goals] = await Promise.all([
    Task.find({ date: { $in: days } }).lean(),
    Habit.find().lean(),
    Goal.find().lean(),
  ]);

  // ── Task stats ──────────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = totalTasks
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // Per-day breakdown
  const perDay = {};
  for (const d of days) perDay[d] = { total: 0, completed: 0 };
  for (const t of tasks) {
    if (perDay[t.date]) {
      perDay[t.date].total += 1;
      if (t.completed) perDay[t.date].completed += 1;
    }
  }
  const dailyTaskStats = Object.entries(perDay).map(([date, s]) => ({
    date,
    total: s.total,
    completed: s.completed,
    rate: s.total ? Math.round((s.completed / s.total) * 100) : null,
  }));

  // Missed high-priority tasks (a strong signal for the coach)
  const missedHighPriority = tasks
    .filter((t) => !t.completed && t.priority === 'high')
    .map((t) => ({ date: t.date, title: t.title, category: t.category }));

  // Category breakdown
  const categoryMap = {};
  for (const t of tasks) {
    const cat = t.category || 'general';
    if (!categoryMap[cat]) categoryMap[cat] = { total: 0, completed: 0 };
    categoryMap[cat].total += 1;
    if (t.completed) categoryMap[cat].completed += 1;
  }
  const categoryStats = Object.entries(categoryMap).map(([cat, s]) => ({
    category: cat,
    total: s.total,
    completed: s.completed,
    rate: Math.round((s.completed / s.total) * 100),
  }));

  // ── Habit stats ─────────────────────────────────────────────────────────────
  const habitSummaries = habits.map((h) => {
    const logsInWindow = (h.logs || []).filter((l) => days.includes(l.date));
    const doneCount = logsInWindow.filter((l) => l.status === 'done').length;
    const missedCount = logsInWindow.filter((l) => l.status === 'missed').length;
    const loggedCount = logsInWindow.length;

    // Detect consecutive misses (last N days without a 'done')
    let consecutiveMisses = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const log = logsInWindow.find((l) => l.date === days[i]);
      if (log?.status === 'done') break;
      consecutiveMisses += 1;
    }

    return {
      name: h.name,
      currentStreak: h.streak ?? 0,
      doneInLast7: doneCount,
      missedInLast7: missedCount,
      notLoggedInLast7: 7 - loggedCount,
      consecutiveMissesFromToday: consecutiveMisses,
      completionRateLast7: loggedCount
        ? Math.round((doneCount / loggedCount) * 100)
        : null,
    };
  });

  // Classify habits by trend
  const habitsThriving = habitSummaries.filter((h) => h.currentStreak >= 3);
  const habitsAtRisk = habitSummaries.filter(
    (h) => h.consecutiveMissesFromToday >= 2 && h.currentStreak < 3
  );

  // ── Goal stats ───────────────────────────────────────────────────────────────
  const goalSummaries = goals.map((g) => ({
    title: g.title,
    progress: g.progress ?? 0,
    target: g.target ?? 100,
    completionPercent: g.target ? Math.round(((g.progress ?? 0) / g.target) * 100) : 0,
    weekStartDate: g.weekStartDate,
  }));

  return {
    windowDays: days,
    tasks: {
      totalInWindow: totalTasks,
      completedInWindow: completedTasks,
      overallCompletionRate: completionRate,
      dailyBreakdown: dailyTaskStats,
      missedHighPriorityTasks: missedHighPriority,
      categoryBreakdown: categoryStats,
    },
    habits: {
      total: habits.length,
      summaries: habitSummaries,
      habitsThriving: habitsThriving.map((h) => h.name),
      habitsAtRisk: habitsAtRisk.map((h) => h.name),
    },
    goals: {
      total: goals.length,
      summaries: goalSummaries,
    },
  };
}

// ─── POST /feedback ───────────────────────────────────────────────────────────

router.post('/feedback', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return res.status(503).json({
      error: 'AI feedback is not configured. Set GEMINI_API_KEY on the server.',
    });
  }

  try {
    const days = last7DayStrings();
    const context = await buildFeedbackContext(days);

    const prompt = `You are a strict but intelligent productivity coach. Your job is to analyze real behavioral data, detect patterns, and deliver sharp, personalized feedback — not generic advice.

Here is the user's productivity data for the last 7 days:

${JSON.stringify(context, null, 2)}

Analyze this data carefully. Look for:
- Days or categories where task completion drops
- Habits that are declining (consecutive misses, low streak)
- High-priority tasks being skipped repeatedly
- Goals with low progress
- Positive momentum worth reinforcing

Respond with ONLY valid JSON (no markdown, no code fences) in exactly this shape:
{
  "pattern": "A 2-3 sentence description of the most significant pattern you detect in this data. Be specific — reference actual numbers, habit names, or dates.",
  "actionPlan": ["Step 1: specific, measurable action", "Step 2: specific, measurable action", "Step 3: specific, measurable action"],
  "insight": "One sharp behavioral insight about WHY this pattern is happening, grounded in the data. Avoid vague psychology — be direct."
}

Rules:
- Reference actual data points (e.g. habit names, completion percentages, specific days).
- No soft motivational filler.
- actionPlan must have exactly 3 items, each starting with a verb.
- insight must be one sentence, incisive and data-driven.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });
    const result = await model.generateContent(prompt);
    const raw = typeof result.response?.text === 'function' ? result.response.text().trim() : '';

    if (!raw) {
      return res.status(502).json({ error: 'The model returned an empty message.' });
    }

    // Parse structured JSON, stripping any accidental code fences
    let parsed;
    try {
      let clean = raw;
      const fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) clean = fence[1].trim();
      parsed = JSON.parse(clean);
      if (
        typeof parsed.pattern !== 'string' ||
        !Array.isArray(parsed.actionPlan) ||
        typeof parsed.insight !== 'string'
      ) {
        throw new Error('Missing required fields in model response');
      }
    } catch (parseErr) {
      console.error('feedback JSON parse error:', parseErr, raw.slice(0, 600));
      return res.status(502).json({
        error: 'Could not parse structured feedback from model.',
        detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
    }

    // Also persist as plain text for history
    const feedbackText = [
      `Pattern Detected: ${parsed.pattern}`,
      `Action Plan:\n${parsed.actionPlan.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      `Coach Insight: ${parsed.insight}`,
    ].join('\n\n');

    let userId = 'anonymous';
    const rawUid = req.body?.userId;
    if (typeof rawUid === 'string' && rawUid.trim()) {
      const u = rawUid.trim();
      userId = mongoose.Types.ObjectId.isValid(u) ? new mongoose.Types.ObjectId(u) : u;
    }

    const saved = await Feedback.create({ userId, text: feedbackText });
    const savedDoc = saved.toObject();
    if (savedDoc._id) savedDoc._id = String(savedDoc._id);

    return res.json({
      feedback: parsed,
      feedbackText,
      saved: savedDoc,
      context: {
        windowDays: context.windowDays,
        taskCompletionRate: context.tasks.overallCompletionRate,
        habitsAtRisk: context.habits.habitsAtRisk,
        habitsThriving: context.habits.habitsThriving,
      },
    });
  } catch (err) {
    console.error('AI feedback error:', err);
    return res.status(500).json({
      error: 'Failed to generate feedback.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});


router.get('/feedback-history', async (_req, res) => {
  try {
    const items = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const rows = items.map((doc) => ({
      _id: String(doc._id),
      userId: doc.userId,
      text: doc.text,
      createdAt: doc.createdAt,
    }));
    return res.json({ items: rows });
  } catch (err) {
    console.error('AI feedback-history error:', err);
    return res.status(500).json({ error: 'Failed to load feedback history.' });
  }
});

function last7DayStrings() {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

function parseWeeklyReportJson(raw) {
  let t = typeof raw === 'string' ? raw.trim() : '';
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const j = JSON.parse(t);
  const improvements = Array.isArray(j.improvements) ? j.improvements.map((x) => String(x)) : [];
  while (improvements.length < 3) improvements.push('');
  return {
    whatWentWell: String(j.whatWentWell ?? ''),
    whatFailed: String(j.whatFailed ?? ''),
    improvements: improvements.slice(0, 3),
  };
}

function parseBreakdownTasks(raw) {
  let t = typeof raw === 'string' ? raw.trim() : '';
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const j = JSON.parse(t);
  const arr = Array.isArray(j.tasks) ? j.tasks : Array.isArray(j) ? j : [];
  return arr
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 7);
}

router.post('/breakdown', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured.' });
  }

  const goalText = typeof req.body?.goalText === 'string' ? req.body.goalText.trim() : '';
  if (!goalText) {
    return res.status(400).json({ error: 'goalText is required' });
  }

  try {
    const prompt = `Break this goal into 5 to 7 actionable tasks.

Goal:
${goalText}

Rules:
- Return ONLY valid JSON.
- No markdown.
- No explanations.
- Keep tasks specific and execution-ready.
- Output shape: {"tasks":["task 1","task 2","task 3","task 4","task 5"]}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });
    const result = await model.generateContent(prompt);
    const text = typeof result.response?.text === 'function' ? result.response.text().trim() : '';
    if (!text) {
      return res.status(502).json({ error: 'The model returned an empty message.' });
    }

    let tasks;
    try {
      tasks = parseBreakdownTasks(text);
    } catch (e) {
      console.error('breakdown parse error:', e, text.slice(0, 400));
      return res.status(502).json({
        error: 'Could not parse breakdown tasks.',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
    if (!tasks.length) {
      return res.status(502).json({ error: 'No tasks were generated by the model.' });
    }
    return res.json({ tasks });
  } catch (err) {
    console.error('ai breakdown error:', err);
    return res.status(500).json({
      error: 'Failed to generate task breakdown.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get('/weekly-report', async (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    return res.status(503).json({ error: 'GEMINI_API_KEY not configured.' });
  }

  try {
    const days = last7DayStrings();
    const [tasks, habits] = await Promise.all([
      Task.find({ date: { $in: days } }).sort({ date: 1 }).lean(),
      Habit.find().lean(),
    ]);

    const habitSummaries = habits.map((h) => ({
      name: h.name,
      streak: h.streak ?? 0,
      logsLast7Days: (h.logs || []).filter((l) => days.includes(l.date)),
    }));

    const payload = {
      calendarDays: days,
      tasks: tasks.map((t) => ({
        date: t.date,
        title: t.title,
        completed: t.completed,
        priority: t.priority,
      })),
      habits: habitSummaries,
    };

    const prompt = `You are a strict, disciplined performance coach. Review the user's last 7 calendar days of tasks and habit logs.

Data (JSON):
${JSON.stringify(payload, null, 2)}

Respond with ONLY valid JSON (no markdown code fences) in exactly this shape:
{"whatWentWell":"string","whatFailed":"string","improvements":["one","two","three"]}

Rules:
- whatWentWell: concrete positives grounded in the data.
- whatFailed: honest gaps (missed habits, incomplete tasks, inconsistency).
- improvements: exactly 3 short, actionable improvements for next week.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = typeof response.text === 'function' ? response.text().trim() : '';

    if (!text) {
      return res.status(502).json({ error: 'The model returned an empty message.' });
    }

    let report;
    try {
      report = parseWeeklyReportJson(text);
    } catch (e) {
      console.error('weekly-report parse error:', e, text.slice(0, 600));
      return res.status(502).json({
        error: 'Could not parse weekly report JSON.',
        detail: e instanceof Error ? e.message : String(e),
      });
    }

    return res.json({
      weekDays: days,
      report,
    });
  } catch (err) {
    console.error('weekly-report error:', err);
    return res.status(500).json({
      error: 'Failed to generate weekly report.',
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

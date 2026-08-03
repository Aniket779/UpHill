/**
 * One-time backfill: assigns a real userId to every document that predates
 * ownership scoping (see the multi-tenancy migration) — either because the
 * field is missing entirely, or because it holds a legacy placeholder like
 * Feedback's old "anonymous" default.
 *
 * Safe to re-run: only touches documents that don't already have a valid
 * ObjectId userId.
 *
 * Usage:
 *   node scripts/backfill-user-ownership.js <ownerUserId>
 *
 * If <ownerUserId> is omitted and exactly one User document exists in the
 * database, that user is used automatically. If zero or more than one User
 * exists, the script refuses to guess and exits without changing anything.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const Habit = require('../src/models/Habit');
const Goal = require('../src/models/Goal');
const Notification = require('../src/models/Notification');
const Feedback = require('../src/models/Feedback');
const CoachChatSession = require('../src/models/CoachChatSession');

async function resolveOwnerId(cliArg) {
  if (cliArg) {
    if (!mongoose.Types.ObjectId.isValid(cliArg)) {
      throw new Error(`"${cliArg}" is not a valid User ObjectId.`);
    }
    const user = await User.findById(cliArg).lean();
    if (!user) throw new Error(`No User found with id ${cliArg}.`);
    return { id: cliArg, label: `${user.name} <${user.email}>` };
  }

  const users = await User.find().select('name email').lean();
  if (users.length === 0) {
    throw new Error('No User documents exist — nothing to assign ownership to.');
  }
  if (users.length > 1) {
    throw new Error(
      `${users.length} User documents exist — pass the target user id explicitly:\n` +
        users.map((u) => `  ${u._id}  ${u.name} <${u.email}>`).join('\n')
    );
  }
  const [only] = users;
  return { id: String(only._id), label: `${only.name} <${only.email}>` };
}

/** Backfills docs where userId is missing or isn't a valid ObjectId (e.g. Feedback's old "anonymous"). */
async function backfillModel(Model, ownerId) {
  const candidates = await Model.find().select('_id userId').lean();
  const toFix = candidates.filter((doc) => !mongoose.Types.ObjectId.isValid(doc.userId));
  if (toFix.length === 0) return 0;
  await Model.updateMany(
    { _id: { $in: toFix.map((d) => d._id) } },
    { $set: { userId: ownerId } }
  );
  return toFix.length;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uphill';
  await mongoose.connect(uri);

  const owner = await resolveOwnerId(process.argv[2]);
  console.log(`Backfilling ownerless documents to: ${owner.label} (${owner.id})`);

  const models = [
    ['Task', Task],
    ['Habit', Habit],
    ['Goal', Goal],
    ['Notification', Notification],
    ['Feedback', Feedback],
    ['CoachChatSession', CoachChatSession],
  ];

  for (const [name, Model] of models) {
    const count = await backfillModel(Model, owner.id);
    console.log(`  ${name}: ${count} document(s) updated`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});

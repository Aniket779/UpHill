const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const habitsRouter = require('./routes/habits');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const mongoUri =
  process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uphill';

app.use(cors());
app.use(express.json());

mongoose
  .connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.use('/habits', habitsRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

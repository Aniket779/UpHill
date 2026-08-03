// Runs before the test framework loads (Jest `setupFiles`), so config/env.js's
// required() checks pass before any test file requires the app.
process.env.JWT_SECRET = 'test_only_secret_do_not_use_elsewhere_1234567890';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/uphill-test-placeholder';
process.env.CORS_ORIGINS = 'http://localhost:5173';

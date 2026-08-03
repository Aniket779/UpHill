/**
 * Smoke check for CI: requires every route/model/middleware/config module
 * so syntax errors, missing dependencies, and broken imports fail loudly —
 * without needing a live MongoDB connection or open port (unlike requiring
 * index.js directly, which immediately connects to Mongo and starts listening).
 *
 * There's no real test suite yet; this is the cheapest thing that would have
 * caught bugs like a route requiring a module that doesn't exist.
 */
const fs = require('fs');
const path = require('path');

const DIRS = ['config', 'middleware', 'models', 'routes', 'socket'];

let failures = 0;

for (const dir of DIRS) {
  const dirPath = path.join(__dirname, '..', 'src', dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const file of fs.readdirSync(dirPath)) {
    if (!file.endsWith('.js')) continue;
    const fullPath = path.join(dirPath, file);
    try {
      require(fullPath);
      console.log(`OK    ${dir}/${file}`);
    } catch (err) {
      failures += 1;
      console.error(`FAIL  ${dir}/${file}`);
      console.error(`      ${err.message}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} module(s) failed to load.`);
  process.exit(1);
}

console.log('\nAll backend modules loaded cleanly.');

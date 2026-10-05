"use strict";
/** Local / traditional server entry: verifies the DB, then listens. */
const { createApp } = require('./app.js');
const { config, assertProductionSecrets } = require('./config.js');
const { pool } = require('./db.js');

assertProductionSecrets();

async function main() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error('Database connection failed. Please contact the system administrator.');
    console.error(err);
    process.exit(1);
  }
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`philfida-dv server listening on :${config.port}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, createApp };

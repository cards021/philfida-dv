"use strict";
/**
 * Local / traditional server entry: verifies the database is reachable,
 * then listens. (On Vercel, `api/server.js` imports the app factory
 * directly and the platform handles listening.)
 */
const { createApp } = require("./app.js");
const { config, assertProductionSecrets } = require("./config.js");
const { pool } = require("./db.js");

assertProductionSecrets();

async function main() {
    try {
        await pool.query("SELECT 1");
    } catch (err) {
        console.error("Database connection failed. Please contact the system administrator.");
        console.error(err);
        process.exit(1);
    }
    const app = createApp();
    app.listen(config.port, () => {
        console.log(`philfida-dv server listening on :${config.port}`);
    });
}

if (require.main === module) {
    void main();
}

module.exports = { main };

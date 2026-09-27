// Run with `npm run seed` to wipe data/db.json back to the original demo
// data — handy before a live walkthrough.
const db = require("./db");
db.resetToSeed();
console.log("Database reset to seed data at", db.DB_PATH);

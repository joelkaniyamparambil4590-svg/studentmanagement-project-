const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const databaseConfigError = !process.env.DATABASE_URL
  ? new Error('DATABASE_URL is required. Add it to backend/.env for local development or Vercel project settings for deployment.')
  : null;

const pool = databaseConfigError ? null : new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getDatabaseConfigError() {
  return databaseConfigError;
}

module.exports = {
  pool,
  getDatabaseConfigError,
};

import { neon } from '@neondatabase/serverless';

// Create a SQL query function using the DATABASE_URL from environment
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

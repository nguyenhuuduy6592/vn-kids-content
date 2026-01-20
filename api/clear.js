import { getDb } from './db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Delete all user progress for this device
    const progressResult = await sql`
      DELETE FROM user_progress
      WHERE device_id = ${deviceId}
      RETURNING *
    `;

    // Delete all content
    const contentResult = await sql`
      DELETE FROM content
      RETURNING *
    `;

    return res.status(200).json({
      success: true,
      deletedProgress: progressResult.length,
      deletedContent: contentResult.length
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

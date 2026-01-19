import { getDb } from './db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = getDb();

    if (req.method === 'GET') {
      // Get all content with optional user progress
      const deviceId = req.query.deviceId;

      if (deviceId) {
        // Join with user_progress for this device
        const rows = await sql`
          SELECT
            c.id, c.title, c.type, c.content, c.created_at,
            COALESCE(up.read_count, 0) as read_count,
            COALESCE(up.favorite, false) as favorite,
            COALESCE(up.archived, false) as archived
          FROM content c
          LEFT JOIN user_progress up ON c.id = up.content_id AND up.device_id = ${deviceId}
          ORDER BY c.id
        `;
        return res.status(200).json(rows);
      } else {
        // Just get content without progress
        const rows = await sql`
          SELECT id, title, type, content, created_at
          FROM content
          ORDER BY id
        `;
        return res.status(200).json(rows);
      }
    }

    if (req.method === 'POST') {
      // Add new content
      const { title, type, content } = req.body;

      if (!title || !type || !content) {
        return res.status(400).json({ error: 'Missing required fields: title, type, content' });
      }

      if (!['song', 'poem', 'story'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be: song, poem, or story' });
      }

      const [row] = await sql`
        INSERT INTO content (title, type, content)
        VALUES (${title}, ${type}, ${content})
        RETURNING id, title, type, content, created_at
      `;

      return res.status(201).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

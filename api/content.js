import { getDb } from './db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Prevent browser caching of API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

    if (req.method === 'PUT') {
      // Update existing content
      const { id, title, content } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing required field: id' });
      }

      if (!title && !content) {
        return res.status(400).json({ error: 'At least one field to update is required: title or content' });
      }

      // Build dynamic update query
      const updates = [];
      const values = [];

      if (title !== undefined) {
        updates.push('title');
        values.push(title);
      }
      if (content !== undefined) {
        updates.push('content');
        values.push(content);
      }

      // Update with dynamic fields
      let row;
      if (title !== undefined && content !== undefined) {
        [row] = await sql`
          UPDATE content
          SET title = ${title}, content = ${content}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, title, type, content, created_at, updated_at
        `;
      } else if (title !== undefined) {
        [row] = await sql`
          UPDATE content
          SET title = ${title}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, title, type, content, created_at, updated_at
        `;
      } else {
        [row] = await sql`
          UPDATE content
          SET content = ${content}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
          RETURNING id, title, type, content, created_at, updated_at
        `;
      }

      if (!row) {
        return res.status(404).json({ error: 'Content not found' });
      }

      return res.status(200).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

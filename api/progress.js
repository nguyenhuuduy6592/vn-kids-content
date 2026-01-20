import { getDb } from './db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      // Get all progress for a device
      const { deviceId } = req.query;

      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId is required' });
      }

      const rows = await sql`
        SELECT content_id, read_count, favorite, archived
        FROM user_progress
        WHERE device_id = ${deviceId}
      `;

      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      // Update progress for a content item
      const { deviceId, contentId, action, value } = req.body;

      if (!deviceId || !contentId || !action) {
        return res.status(400).json({ error: 'Missing required fields: deviceId, contentId, action' });
      }

      // Upsert based on action type
      let result;

      switch (action) {
        case 'markRead':
          // Increment read count
          result = await sql`
            INSERT INTO user_progress (device_id, content_id, read_count)
            VALUES (${deviceId}, ${contentId}, 1)
            ON CONFLICT (device_id, content_id)
            DO UPDATE SET read_count = user_progress.read_count + 1
            RETURNING *
          `;
          break;

        case 'toggleFavorite':
          // Toggle favorite status
          result = await sql`
            INSERT INTO user_progress (device_id, content_id, favorite)
            VALUES (${deviceId}, ${contentId}, true)
            ON CONFLICT (device_id, content_id)
            DO UPDATE SET favorite = NOT user_progress.favorite
            RETURNING *
          `;
          break;

        case 'toggleArchive':
          // Toggle archived status
          result = await sql`
            INSERT INTO user_progress (device_id, content_id, archived)
            VALUES (${deviceId}, ${contentId}, true)
            ON CONFLICT (device_id, content_id)
            DO UPDATE SET archived = NOT user_progress.archived
            RETURNING *
          `;
          break;

        case 'setProgress':
          // Set specific values (for sync/import)
          const { readCount = 0, favorite = false, archived = false } = value || {};
          result = await sql`
            INSERT INTO user_progress (device_id, content_id, read_count, favorite, archived)
            VALUES (${deviceId}, ${contentId}, ${readCount}, ${favorite}, ${archived})
            ON CONFLICT (device_id, content_id)
            DO UPDATE SET
              read_count = ${readCount},
              favorite = ${favorite},
              archived = ${archived}
            RETURNING *
          `;
          break;

        default:
          return res.status(400).json({ error: 'Invalid action. Must be: markRead, toggleFavorite, toggleArchive, or setProgress' });
      }

      return res.status(200).json(result[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

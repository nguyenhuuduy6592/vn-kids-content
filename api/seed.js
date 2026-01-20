import { getDb } from './db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Prevent browser caching of API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { items, deviceId } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    let insertedCount = 0;
    let progressCount = 0;

    for (const item of items) {
      const { title, type, content, readCount = 0, favorite = false, archived = false } = item;

      if (!title || !type || !content) {
        continue; // Skip invalid items
      }

      // Insert content (skip if title+type already exists)
      const [existing] = await sql`
        SELECT id FROM content WHERE title = ${title} AND type = ${type}
      `;

      let contentId;
      if (existing) {
        contentId = existing.id;
      } else {
        const [inserted] = await sql`
          INSERT INTO content (title, type, content)
          VALUES (${title}, ${type}, ${content})
          RETURNING id
        `;
        contentId = inserted.id;
        insertedCount++;
      }

      // If deviceId provided, also save user progress
      if (deviceId && contentId) {
        await sql`
          INSERT INTO user_progress (device_id, content_id, read_count, favorite, archived)
          VALUES (${deviceId}, ${contentId}, ${readCount}, ${favorite}, ${archived})
          ON CONFLICT (device_id, content_id)
          DO UPDATE SET
            read_count = ${readCount},
            favorite = ${favorite},
            archived = ${archived}
        `;
        progressCount++;
      }
    }

    return res.status(200).json({
      success: true,
      insertedContent: insertedCount,
      updatedProgress: progressCount
    });
  } catch (error) {
    console.error('Seed Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

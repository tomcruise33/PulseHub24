const express = require('express');
const router = express.Router();
const db = require('../db');

// Get latest news articles
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const query = `
      SELECT 
        n.*,
        array_agg(nc.name) as categories
      FROM news_articles n
      LEFT JOIN article_categories ac ON n.id = ac.article_id
      LEFT JOIN news_categories nc ON ac.category_id = nc.id
      WHERE n.status = 'published'
      GROUP BY n.id
      ORDER BY n.published_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await db.query(query, [limit, offset]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get news by geographic location
router.get('/geo', async (req, res) => {
  try {
    const { lat, lng, radius = 100, limit = 20 } = req.query;
    const query = `
      SELECT 
        *,
        ST_Distance(
          location_point::geography,
          ST_MakePoint($1, $2)::geography
        ) as distance
      FROM news_articles
      WHERE ST_DWithin(
        location_point::geography,
        ST_MakePoint($1, $2)::geography,
        $3 * 1000
      )
      AND status = 'published'
      ORDER BY published_at DESC
      LIMIT $4
    `;
    const result = await db.query(query, [lng, lat, radius, limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching geo news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search news articles
router.get('/search', async (req, res) => {
  try {
    const { q, category, from, to, limit = 20, offset = 0 } = req.query;
    let query = `
      SELECT 
        n.*,
        array_agg(nc.name) as categories
      FROM news_articles n
      LEFT JOIN article_categories ac ON n.id = ac.article_id
      LEFT JOIN news_categories nc ON ac.category_id = nc.id
      WHERE n.status = 'published'
    `;
    const params = [];
    let paramCount = 1;

    if (q) {
      query += ` AND (n.title ILIKE $${paramCount} OR n.content ILIKE $${paramCount})`;
      params.push(`%${q}%`);
      paramCount++;
    }

    if (category) {
      query += ` AND nc.name = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (from) {
      query += ` AND n.published_at >= $${paramCount}`;
      params.push(from);
      paramCount++;
    }

    if (to) {
      query += ` AND n.published_at <= $${paramCount}`;
      params.push(to);
      paramCount++;
    }

    query += `
      GROUP BY n.id
      ORDER BY n.published_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching news:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

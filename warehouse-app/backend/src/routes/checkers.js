const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Get all checkers (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM checkers WHERE active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add checker (admin only)
router.post('/', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO checkers (name) VALUES ($1) RETURNING *', [name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete checker (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE checkers SET active = false WHERE id = $1', [req.params.id]
    );
    res.json({ message: 'Checker removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
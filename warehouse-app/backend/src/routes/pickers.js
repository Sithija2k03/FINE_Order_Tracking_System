const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Get all pickers (public - for picker selection screen)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name FROM pickers WHERE active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add picker (admin only)
router.post('/', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO pickers (name) VALUES ($1) RETURNING *', [name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete picker (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE pickers SET active = false WHERE id = $1', [req.params.id]
    );
    res.json({ message: 'Picker removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
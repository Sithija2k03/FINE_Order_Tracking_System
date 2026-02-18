const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');

// Get all orders
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.*,
        p.name AS picker_name,
        c.name AS checker_name,
        TO_CHAR(o.picking_duration, 'HH24:MI:SS') AS picking_time,
        TO_CHAR(o.idle_duration, 'HH24:MI:SS') AS idle_time,
        TO_CHAR(o.checking_duration, 'HH24:MI:SS') AS checking_time,
        TO_CHAR(o.total_duration, 'HH24:MI:SS') AS total_time
      FROM orders o
      LEFT JOIN pickers p ON o.picker_id = p.id
      LEFT JOIN checkers c ON o.checker_id = c.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new order (admin)
router.post('/', auth, async (req, res) => {
  const { so_number, size, delivery_type } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO orders (so_number, size, delivery_type) 
       VALUES ($1, $2, $3) RETURNING *`,
      [so_number, size, delivery_type]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign picker (admin)
router.patch('/:id/assign', auth, async (req, res) => {
  const { picker_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE orders SET picker_id = $1, status = 'ASSIGNED', updated_at = NOW()
       WHERE id = $2 AND status IN ('UNASSIGNED', 'ASSIGNED') RETURNING *`,
      [picker_id, req.params.id]
    );
    if (!result.rows[0]) return res.status(400).json({ error: 'Cannot reassign after picking started' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start picking (picker)
router.patch('/:id/start-picking', async (req, res) => {
  const { picker_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'PICKING', picker_start = NOW(), updated_at = NOW()
       WHERE id = $1 AND picker_id = $2 AND status = 'ASSIGNED' RETURNING *`,
      [req.params.id, picker_id]
    );
    if (!result.rows[0]) return res.status(400).json({ error: 'Cannot start picking' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End picking (picker)
router.patch('/:id/end-picking', async (req, res) => {
  const { picker_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'PICKED', 
           picker_end = NOW(), 
           idle_start = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND picker_id = $2 AND status = 'PICKING' RETURNING *`,
      [req.params.id, picker_id]
    );
    if (!result.rows[0]) return res.status(400).json({ error: 'Cannot end picking' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start checking (checker)
router.patch('/:id/start-checking', async (req, res) => {
  const { checker_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'CHECKING',
           checker_id = $1,
           checker_start = NOW(),
           idle_end = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND status = 'PICKED' RETURNING *`,
      [checker_id, req.params.id]
    );
    if (!result.rows[0]) return res.status(400).json({ error: 'Order not ready for checking' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// End checking (checker)
router.patch('/:id/end-checking', async (req, res) => {
  const { checker_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE orders 
       SET status = 'DONE',
           checker_end = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND checker_id = $2 AND status = 'CHECKING' RETURNING *`,
      [checker_id, req.params.id]
    );
    if (!result.rows[0]) return res.status(400).json({ error: 'Cannot end checking' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export orders (admin) - returns data for Excel download
router.get('/export', auth, async (req, res) => {
  const { date } = req.query; // ?date=2026-02-18
  try {
    const result = await pool.query(`
      SELECT
        o.so_number                                  AS "SO Number",
        o.status                                     AS "Status",
        o.size                                       AS "Order Size",
        o.delivery_type                              AS "Delivery Type",
        p.name                                       AS "Picker Name",
        TO_CHAR(o.picker_start, 'HH24:MI:SS')       AS "Pick Start",
        TO_CHAR(o.picker_end,   'HH24:MI:SS')       AS "Pick End",
        TO_CHAR(o.picking_duration, 'HH24:MI:SS')   AS "Picking Duration",
        TO_CHAR(o.idle_start, 'HH24:MI:SS')         AS "Idle Start",
        TO_CHAR(o.idle_end,   'HH24:MI:SS')         AS "Idle End",
        TO_CHAR(o.idle_duration, 'HH24:MI:SS')      AS "Idle Time",
        c.name                                       AS "Checker Name",
        TO_CHAR(o.checker_start, 'HH24:MI:SS')      AS "Check Start",
        TO_CHAR(o.checker_end,   'HH24:MI:SS')      AS "Check End",
        TO_CHAR(o.checking_duration, 'HH24:MI:SS')  AS "Checking Duration",
        TO_CHAR(o.total_duration, 'HH24:MI:SS')     AS "Total Duration",
        DATE(o.created_at)                           AS "Date"
      FROM orders o
      LEFT JOIN pickers p  ON o.picker_id  = p.id
      LEFT JOIN checkers c ON o.checker_id = c.id
      WHERE DATE(o.created_at) = $1
      ORDER BY o.created_at ASC
    `, [date || new Date().toISOString().split('T')[0]]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
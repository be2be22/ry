const express = require('express');
const fs = require('fs');
const { requireAuth } = require('../middleware');
const { LOG_PATH, ACCESS_LOG_PATH } = require('../xray');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const type = req.query.type === 'access' ? 'access' : 'error';
  const lines = Math.min(Math.max(parseInt(req.query.lines, 10) || 200, 10), 1000);
  const filePath = type === 'access' ? ACCESS_LOG_PATH : LOG_PATH;

  let linesArr = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    linesArr = content.split('\n').filter((l) => l.length > 0);
  } catch {
    linesArr = [];
  }

  const tail = linesArr.slice(-lines);
  res.json({ logs: tail, type, total: linesArr.length });
});

module.exports = router;

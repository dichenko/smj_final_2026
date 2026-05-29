const express = require('express');
const pool = require('../db');

const router = express.Router();

const FORM_SECTIONS = [
  { key: 'success', dbSection: 'green' },
  { key: 'lapse', dbSection: 'blue' },
  { key: 'insight', dbSection: 'red' },
];

const PUBLIC_SECTIONS = new Set(['green', 'blue', 'red']);
const PUBLIC_SECTION_ALIASES = {
  success: 'green',
  lapse: 'blue',
  insight: 'red',
};

const SECTION_LABELS = {
  green: 'Успех',
  blue: 'Ляп',
  red: 'Инсайт',
};

function normalizeText(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
}

function xmlCell(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function hasSubmitted(client, cookieId) {
  const result = await client.query(
    `SELECT
       EXISTS(SELECT 1 FROM submissions WHERE cookie_id = $1) OR
       EXISTS(SELECT 1 FROM answers WHERE cookie_id = $1)
       AS submitted`,
    [cookieId]
  );
  return Boolean(result.rows[0].submitted);
}

function requireAdmin(req, res, next) {
  if (req.cookies.admin_token !== req.app.locals.adminToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.get('/answers/status', async (req, res) => {
  const result = await pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM submissions WHERE cookie_id = $1) OR
       EXISTS(SELECT 1 FROM answers WHERE cookie_id = $1)
       AS submitted`,
    [req.userId]
  );

  res.json({ submitted: Boolean(result.rows[0].submitted) });
});

router.post('/answers', async (req, res) => {
  const fingerprint = req.fingerprint;
  const entries = FORM_SECTIONS
    .map(function(section) {
      const rawValue = req.body[section.key] || req.body[section.dbSection];
      return {
        section: section.dbSection,
        text: normalizeText(rawValue),
      };
    })
    .filter(function(entry) {
      return entry.text.length > 0;
    });

  if (entries.length === 0) {
    return res.status(400).json({ error: 'At least one field is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (await hasSubmitted(client, req.userId)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Already submitted', alreadySubmitted: true });
    }

    const submission = await client.query(
      `INSERT INTO submissions (cookie_id, fingerprint_hash)
       VALUES ($1, $2)
       ON CONFLICT (cookie_id) DO NOTHING
       RETURNING cookie_id`,
      [req.userId, fingerprint]
    );

    if (submission.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Already submitted', alreadySubmitted: true });
    }

    for (const entry of entries) {
      await client.query(
        'INSERT INTO answers (fingerprint_hash, cookie_id, section, field_index, text) VALUES ($1, $2, $3, 0, $4)',
        [fingerprint, req.userId, entry.section, entry.text]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to save answers:', error);
    res.status(500).json({ error: 'Failed to save answers' });
  } finally {
    client.release();
  }
});

router.get('/public', async (req, res) => {
  const { section } = req.query;
  const params = [];
  let query = 'SELECT id, section, text, created_at FROM answers WHERE is_active = TRUE';
  const normalizedSection = PUBLIC_SECTION_ALIASES[section] || section;

  if (normalizedSection && PUBLIC_SECTIONS.has(normalizedSection)) {
    query += ' AND section = $1';
    params.push(normalizedSection);
  }

  query += ' ORDER BY created_at ASC, id ASC';

  const result = await pool.query(query, params);
  res.json(result.rows);
});

router.get('/admin', requireAdmin, async (req, res) => {
  const { section, search, page = 1, limit = 20 } = req.query;
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (p - 1) * l;
  const params = [];
  const conditions = [];

  if (section && ['green', 'blue', 'red'].includes(section)) {
    conditions.push(`section = $${params.length + 1}`);
    params.push(section);
  }

  if (search && search.trim()) {
    conditions.push(`text ILIKE $${params.length + 1}`);
    params.push(`%${search.trim()}%`);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM answers ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await pool.query(
    `SELECT id, fingerprint_hash, section, field_index, text, is_active, parent_id, created_at, updated_at
     FROM answers ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, l, offset]
  );

  res.json({ rows: result.rows, total, page: p, limit: l });
});

router.get('/admin/export.xls', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT section, text
     FROM answers
     WHERE is_active = TRUE
     ORDER BY created_at ASC, id ASC`
  );

  const rows = result.rows.map(function(row) {
    return [
      '<Row>',
      `<Cell><Data ss:Type="String">${xmlCell(row.text)}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${xmlCell(SECTION_LABELS[row.section] || row.section)}</Data></Cell>`,
      '</Row>',
    ].join('');
  }).join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<Worksheet ss:Name="Ответы">',
    '<Table>',
    '<Column ss:Width="420"/>',
    '<Column ss:Width="110"/>',
    '<Row>',
    '<Cell><Data ss:Type="String">текст</Data></Cell>',
    '<Cell><Data ss:Type="String">тип</Data></Cell>',
    '</Row>',
    rows,
    '</Table>',
    '</Worksheet>',
    '</Workbook>',
  ].join('');

  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="answers.xls"');
  res.send('\ufeff' + xml);
});

router.delete('/admin/all', requireAdmin, async (req, res) => {
  await pool.query('TRUNCATE TABLE submissions, answers RESTART IDENTITY');
  res.json({ success: true });
});

router.put('/admin/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const current = await pool.query('SELECT * FROM answers WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  const old = current.rows[0];

  await pool.query(
    'UPDATE answers SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
    [id]
  );

  const result = await pool.query(
    `INSERT INTO answers (fingerprint_hash, cookie_id, section, field_index, text, is_active, parent_id, created_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, NOW()) RETURNING *`,
    [old.fingerprint_hash, old.cookie_id, old.section, old.field_index, text.trim(), old.id]
  );

  res.json(result.rows[0]);
});

router.delete('/admin/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  await pool.query('UPDATE answers SET parent_id = NULL WHERE parent_id = $1', [id]);

  const result = await pool.query('DELETE FROM answers WHERE id = $1 RETURNING *', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json({ success: true });
});

module.exports = router;

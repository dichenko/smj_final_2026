const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

router.get('/public', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'public.html'));
});

router.use((req, res, next) => {
  const adminPath = req.app.locals.adminPath;
  if (req.path === adminPath) {
    return res.sendFile(path.join(__dirname, '..', 'views', 'admin.html'));
  }
  res.status(404).send('Not found');
});

module.exports = router;

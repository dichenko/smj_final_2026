const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const pool = require('./db');
const apiRoutes = require('./routes/api');
const pagesRoutes = require('./routes/pages');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;

const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(48).toString('hex');
const ADMIN_PATH = ADMIN_SECRET.startsWith('admin_')
  ? `/${ADMIN_SECRET}`
  : `/admin_${ADMIN_SECRET}`;
const ADMIN_TOKEN = crypto.createHash('sha256').update(ADMIN_SECRET).digest('hex');

app.locals.adminPath = ADMIN_PATH;
app.locals.adminToken = ADMIN_TOKEN;

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (!req.cookies.user_id) {
    const userId = crypto.randomUUID();
    res.cookie('user_id', userId, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    });
    req.userId = userId;
  } else {
    req.userId = req.cookies.user_id;
  }
  next();
});

app.use((req, res, next) => {
  const ip = req.ip || '127.0.0.1';
  const ua = req.headers['user-agent'] || '';
  req.fingerprint = crypto.createHash('sha256').update(ip + ua).digest('hex');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', apiRoutes);

app.use('/', pagesRoutes);

pool.ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Admin URL: http://localhost:${PORT}${ADMIN_PATH}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  });

// Distribution Tracker v2.0.0 — https://github.com/wdebonne/web-distributions
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dt-dev-secret-change-in-prod';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, d = Math.PI / 180;
  const a = Math.sin((lat2-lat1)*d/2)**2 + Math.cos(lat1*d)*Math.cos(lat2*d)*Math.sin((lon2-lon1)*d/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function getBase(req) { return BASE_URL || `${req.protocol}://${req.get('host')}`; }

// ── JWT Auth ─────────────────────────────────────────
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(t) { try { return jwt.verify(t, JWT_SECRET); } catch { return null; } }

function auth(roles = []) {
  return (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non connecté' });
    const p = verifyToken(h.slice(7));
    if (!p) return res.status(401).json({ error: 'Session expirée' });
    if (roles.length && !roles.includes(p.role)) return res.status(403).json({ error: 'Accès insuffisant' });
    req.user = p;
    next();
  };
}

function canManageDist(req, res, id, cb) {
  const d = db.getDistribution(id);
  if (!d) return res.status(404).json({ error: 'Distribution non trouvée' });
  if (req.user.role === 'admin' || d.creator_id === req.user.id || db.isDistManager(id, req.user.id)) return cb(d);
  res.status(403).json({ error: 'Accès interdit' });
}

// ── Email ─────────────────────────────────────────────
async function getTransporter() {
  const s = db.getSmtpSettings();
  if (!s?.enabled || !s.host) return null;
  return nodemailer.createTransport({
    host: s.host, port: s.port || 587, secure: !!s.secure,
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
    tls: { rejectUnauthorized: false }
  });
}
async function sendEmail(to, tplName, vars) {
  const tpl = db.getEmailTemplate(tplName);
  const t = await getTransporter();
  if (!tpl || !t) return false;
  const s = db.getSmtpSettings();
  const fill = str => Object.entries(vars).reduce((r,[k,v]) => r.replace(new RegExp(`{{${k}}}`, 'g'), v ?? ''), str);
  try {
    await t.sendMail({ from: `"${s.from_name}" <${s.from_email}>`, to, subject: fill(tpl.subject), html: fill(tpl.html) });
    return true;
  } catch(e) { console.error('Email error:', e.message); return false; }
}

// ══════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const user = db.getUserByEmail(email.trim());
  if (!user || !user.active) return res.status(401).json({ error: 'Identifiants incorrects' });
  if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Identifiants incorrects' });
  db.updateLastLogin(user.id, Date.now());
  res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name, role: user.role, forceChange: !!user.force_password_change } });
});

app.get('/api/auth/me', auth(), (req, res) => {
  const u = db.getUserById(req.user.id);
  if (!u) return res.status(404).json({ error: 'Non trouvé' });
  res.json({ id: u.id, email: u.email, name: u.name, role: u.role });
});

app.put('/api/auth/change-password', auth(), async (req, res) => {
  const { current, newPassword } = req.body;
  const u = db.getUserById(req.user.id);
  if (!await bcrypt.compare(current, u.password_hash)) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Minimum 8 caractères' });
  db.updateUserPassword(req.user.id, await bcrypt.hash(newPassword, 10), false);
  res.json({ success: true });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  res.json({ success: true }); // toujours 200 pour ne pas révéler les emails
  const user = db.getUserByEmail((req.body.email || '').trim());
  if (!user) return;
  const token = uuidv4().replace(/-/g, '');
  db.setResetToken(user.id, token, Date.now() + 3600000);
  await sendEmail(user.email, 'reset-password', {
    name: user.name, app_name: 'Distribution Tracker',
    url: `${getBase(req)}/reset-password.html?token=${token}`
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Minimum 8 caractères' });
  const user = db.getUserByResetToken(token);
  if (!user) return res.status(400).json({ error: 'Lien invalide ou expiré' });
  db.updateUserPassword(user.id, await bcrypt.hash(newPassword, 10), false);
  db.clearResetToken(user.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════
// ADMIN — Utilisateurs
// ══════════════════════════════════════════════════════
app.get('/api/admin/users', auth(['admin']), (req, res) => res.json(db.getAllUsers()));

app.post('/api/admin/users', auth(['admin']), async (req, res) => {
  const { email, name, role, password, sendWelcome } = req.body;
  if (!email || !name || !['admin','creator'].includes(role)) return res.status(400).json({ error: 'Email, nom et rôle requis' });
  if (db.getUserByEmail(email.trim())) return res.status(400).json({ error: 'Email déjà utilisé' });
  const pwd = password || Math.random().toString(36).slice(-10);
  const id  = uuidv4().replace(/-/g,'').slice(0,16);
  db.createAppUser({ id, email: email.trim().toLowerCase(), name, role, hash: await bcrypt.hash(pwd, 10), now: Date.now(), forceChange: !password });
  if (sendWelcome || !password) {
    await sendEmail(email, 'welcome', {
      name, email: email.trim(), password: pwd,
      url: getBase(req) + '/login.html', app_name: 'Distribution Tracker'
    });
  }
  res.json({ success: true, id, generatedPassword: !password ? pwd : undefined });
});

app.put('/api/admin/users/:id', auth(['admin']), (req, res) => {
  const { name, role, active, email } = req.body;
  const u = db.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Non trouvé' });
  if (req.params.id === req.user.id && role && role !== 'admin') return res.status(400).json({ error: 'Impossible de changer son propre rôle' });
  db.updateAppUser(req.params.id, { name: name ?? u.name, role: role ?? u.role, active: active !== undefined ? (active ? 1 : 0) : u.active, email: email?.trim().toLowerCase() ?? u.email });
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', auth(['admin']), (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
  db.deleteAppUser(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/users/:id/reset-password', auth(['admin']), async (req, res) => {
  const u = db.getUserById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Non trouvé' });
  const pwd = req.body.newPassword || Math.random().toString(36).slice(-10);
  db.updateUserPassword(req.params.id, await bcrypt.hash(pwd, 10), !req.body.newPassword);
  if (!req.body.newPassword) {
    await sendEmail(u.email, 'reset-password', {
      name: u.name, app_name: 'Distribution Tracker',
      url: getBase(req) + '/login.html'
    });
  }
  res.json({ success: true, generatedPassword: !req.body.newPassword ? pwd : undefined });
});

// ══════════════════════════════════════════════════════
// ADMIN — SMTP
// ══════════════════════════════════════════════════════
app.get('/api/admin/smtp', auth(['admin']), (req, res) => {
  const s = { ...db.getSmtpSettings() };
  if (s) s.smtp_pass = s.smtp_pass ? '••••••••' : ''; // mask password
  res.json(s || {});
});

app.put('/api/admin/smtp', auth(['admin']), (req, res) => {
  db.saveSmtpSettings(req.body);
  res.json({ success: true });
});

app.post('/api/admin/smtp/test', auth(['admin']), async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Adresse requise' });
  const t = await getTransporter();
  if (!t) return res.status(400).json({ error: 'SMTP non configuré ou désactivé' });
  const s = db.getSmtpSettings();
  try {
    await t.sendMail({ from: `"${s.from_name}" <${s.from_email}>`, to, subject: '✅ Test SMTP — Distribution Tracker', html: '<p>La configuration SMTP fonctionne ! 🎉</p>' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════
// ADMIN — Templates email
// ══════════════════════════════════════════════════════
app.get('/api/admin/templates', auth(['admin']), (req, res) => res.json(db.getAllEmailTemplates()));

app.put('/api/admin/templates/:name', auth(['admin']), (req, res) => {
  const { subject, html } = req.body;
  if (!subject || !html) return res.status(400).json({ error: 'Sujet et contenu requis' });
  db.saveEmailTemplate(req.params.name, subject, html);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════
// DISTRIBUTIONS
// ══════════════════════════════════════════════════════
app.get('/api/distributions', auth(), (req, res) =>
  res.json(req.user.role === 'admin' ? db.getDistributions() : db.getCreatorDistributions(req.user.id))
);

app.post('/api/distributions', auth(), (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
  const id = uuidv4().replace(/-/g,'').slice(0,10), now = Date.now();
  db.createDistribution({ id, name: name.trim(), description: description?.trim() || '', now, creatorId: req.user.id });
  res.json({ id, name: name.trim(), url: `${getBase(req)}/distribution.html?id=${id}` });
});

app.get('/api/distributions/:id', (req, res) => {
  const d = db.getDistribution(req.params.id);
  if (!d) return res.status(404).json({ error: 'Non trouvée' });
  res.json({ ...d, users: db.getDistributionUsers(req.params.id) });
});

app.get('/api/distributions/:id/qr', auth(), (req, res) =>
  canManageDist(req, res, req.params.id, async (d) => {
    const url = `${getBase(req)}/distribution.html?id=${d.id}`;
    res.json({ qr: await QRCode.toDataURL(url, { width: 300, margin: 2 }), url });
  })
);

app.post('/api/distributions/:id/close', auth(), (req, res) =>
  canManageDist(req, res, req.params.id, () => {
    db.closeDistribution(req.params.id, Date.now());
    io.to(`dist-${req.params.id}`).emit('distribution-closed');
    res.json({ success: true });
  })
);

app.delete('/api/distributions/:id', auth(), (req, res) => {
  const d = db.getDistribution(req.params.id);
  if (!d) return res.status(404).json({ error: 'Non trouvée' });
  if (req.user.role !== 'admin' && d.creator_id !== req.user.id) return res.status(403).json({ error: 'Accès interdit' });
  db.deleteDistribution(req.params.id);
  res.json({ success: true });
});

app.put('/api/distributions/:id/reassign', auth(['admin']), (req, res) => {
  if (!db.getUserById(req.body.creatorId)) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  db.reassignDistribution(req.params.id, req.body.creatorId);
  res.json({ success: true });
});

app.get('/api/distributions/:id/routes', (req, res) => {
  if (!db.getDistribution(req.params.id)) return res.status(404).json({ error: 'Non trouvée' });
  res.json(db.getDistributionRoutes(req.params.id));
});

app.get('/api/distributions/:id/report', auth(), (req, res) =>
  canManageDist(req, res, req.params.id, (dist) => {
    const users = db.getDistributionUsers(req.params.id);
    const routes = db.getDistributionRoutes(req.params.id);
    const stats = users.map(u => {
      const ur = routes.find(r => r.userId === u.id);
      const pts = ur ? ur.segments.flatMap(s => s.points.map(p => ({...p, seg: s.seg}))) : [];
      let dist = 0;
      for (let i = 1; i < pts.length; i++) if (pts[i].seg === pts[i-1].seg) dist += haversine(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon);
      let duration = 0;
      db.getUserSessions(u.id).forEach(s => { duration += (s.end_time || Date.now()) - s.start_time; });
      return { ...u, distance: Math.round(dist * 1000) / 1000, duration, pointCount: pts.length };
    });
    const td = stats.reduce((a, s) => a + s.distance, 0);
    res.json({ distribution: dist, users: stats, routes, totalDistance: Math.round(td*1000)/1000, totalDuration: Math.max(...stats.map(s=>s.duration), 0) });
  })
);

// ── Délégation ────────────────────────────────────────
app.get('/api/distributions/:id/managers', auth(), (req, res) =>
  canManageDist(req, res, req.params.id, () => res.json(db.getDistManagers(req.params.id)))
);
app.post('/api/distributions/:id/managers', auth(), (req, res) =>
  canManageDist(req, res, req.params.id, () => {
    const u = db.getUserById(req.body.userId);
    if (!u) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    db.addDistManager(req.params.id, req.body.userId, req.body.type || 'manager', Date.now());
    res.json({ success: true });
  })
);
app.delete('/api/distributions/:id/managers/:uid', auth(), (req, res) =>
  canManageDist(req, res, req.params.id, () => { db.removeDistManager(req.params.id, req.params.uid); res.json({ success: true }); })
);

// ── Join (public) ─────────────────────────────────────
app.post('/api/distributions/:id/join', (req, res) => {
  const { name, color } = req.body;
  const dist = db.getDistribution(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Distribution non trouvée' });
  if (dist.status === 'closed') return res.status(400).json({ error: 'Cette distribution est clôturée' });
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
  const existing = db.getUserByName(req.params.id, name.trim());
  if (existing) return res.json({ userId: existing.id, token: existing.token, color: existing.color, name: existing.name, isExisting: true });
  if (!color) return res.status(400).json({ error: 'La couleur est requise' });
  if (db.getTakenColors(req.params.id).includes(color)) return res.status(400).json({ error: 'Couleur déjà prise' });
  const userId = uuidv4().replace(/-/g,'').slice(0,16), token = uuidv4().replace(/-/g,''), now = Date.now();
  db.createUser({ userId, distributionId: req.params.id, name: name.trim(), color, token, now });
  db.startSession(userId, now);
  io.to(`dist-${req.params.id}`).emit('user-joined', { id: userId, name: name.trim(), color, status: 'active', joinedAt: now });
  res.json({ userId, token, color, name: name.trim(), isExisting: false });
});

// ── Socket.io ─────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join', ({ distributionId }) => socket.join(`dist-${distributionId}`));
  socket.on('location', ({ userId, token, lat, lon, ts }) => {
    const u = db.validateUserToken(userId, token);
    if (!u || u.status !== 'active') return;
    const seg = db.getCurrentSegment(userId);
    db.addLocation({ userId, lat, lon, ts, segment: seg });
    db.updateUserLastSeen(userId, ts);
    io.to(`dist-${u.distribution_id}`).emit('location', { userId, lat, lon, ts, segment: seg });
  });
  socket.on('pause', ({ userId, token }) => {
    const u = db.validateUserToken(userId, token); if (!u) return;
    const now = Date.now(); db.pauseUser(userId, now); db.endSession(userId, now);
    io.to(`dist-${u.distribution_id}`).emit('user-status', { userId, status: 'paused' });
  });
  socket.on('resume', ({ userId, token }) => {
    const u = db.validateUserToken(userId, token); if (!u) return;
    const now = Date.now(); db.resumeUser(userId, now); db.startSession(userId, now);
    io.to(`dist-${u.distribution_id}`).emit('user-status', { userId, status: 'active', segment: db.getCurrentSegment(userId) });
  });
  socket.on('done', ({ userId, token }) => {
    const u = db.validateUserToken(userId, token); if (!u) return;
    const now = Date.now(); db.markUserDone(userId, now); db.endSession(userId, now);
    io.to(`dist-${u.distribution_id}`).emit('user-status', { userId, status: 'done' });
  });
});

db.init().then(() => {
  server.listen(PORT, () => console.log(`Distribution Tracker v2.0.0 → http://localhost:${PORT}`));
}).catch(e => { console.error('DB init:', e); process.exit(1); });

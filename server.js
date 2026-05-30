// Distribution Tracker v1.0.0 — https://github.com/wdebonne/web-distributions
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const BASE_URL = process.env.BASE_URL || '';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function adminAuth(req, res, next) {
  const pwd = req.headers['x-admin-pwd'] || req.query.pwd;
  if (pwd !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Non autorisé' });
  next();
}

function getBaseUrl(req) {
  return BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// Admin login
app.post('/api/admin/login', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Mot de passe incorrect' });
  res.json({ success: true, token: ADMIN_PASSWORD });
});

// Create distribution
app.post('/api/distributions', adminAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });
  const id = uuidv4().replace(/-/g, '').substring(0, 10);
  const now = Date.now();
  db.createDistribution({ id, name: name.trim(), description: description?.trim() || '', now });
  const url = `${getBaseUrl(req)}/distribution.html?id=${id}`;
  res.json({ id, name: name.trim(), url });
});

// List distributions (admin)
app.get('/api/distributions', adminAuth, (req, res) => {
  res.json(db.getDistributions());
});

// Get distribution info (public - for user join page)
app.get('/api/distributions/:id', (req, res) => {
  const dist = db.getDistribution(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Distribution non trouvée' });
  const users = db.getDistributionUsers(req.params.id);
  res.json({ ...dist, users });
});

// Get QR code (admin)
app.get('/api/distributions/:id/qr', adminAuth, async (req, res) => {
  const dist = db.getDistribution(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Non trouvée' });
  const url = `${getBaseUrl(req)}/distribution.html?id=${dist.id}`;
  const qr = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  res.json({ qr, url });
});

// Join distribution (user)
app.post('/api/distributions/:id/join', (req, res) => {
  const { name, color } = req.body;
  const dist = db.getDistribution(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Distribution non trouvée' });
  if (dist.status === 'closed') return res.status(400).json({ error: 'Cette distribution est clôturée' });
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis' });

  const existing = db.getUserByName(req.params.id, name.trim());
  if (existing) {
    return res.json({ userId: existing.id, token: existing.token, color: existing.color, name: existing.name, isExisting: true });
  }

  if (!color) return res.status(400).json({ error: 'La couleur est requise' });
  const takenColors = db.getTakenColors(req.params.id);
  if (takenColors.includes(color)) return res.status(400).json({ error: 'Cette couleur est déjà utilisée' });

  const userId = uuidv4().replace(/-/g, '').substring(0, 16);
  const token = uuidv4().replace(/-/g, '');
  const now = Date.now();
  db.createUser({ userId, distributionId: req.params.id, name: name.trim(), color, token, now });
  db.startSession(userId, now);

  io.to(`dist-${req.params.id}`).emit('user-joined', { id: userId, name: name.trim(), color, status: 'active', joinedAt: now });
  res.json({ userId, token, color, name: name.trim(), isExisting: false });
});

// Get routes (used by tracking & report pages)
app.get('/api/distributions/:id/routes', (req, res) => {
  const dist = db.getDistribution(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Non trouvée' });
  res.json(db.getDistributionRoutes(req.params.id));
});

// Close distribution (admin)
app.post('/api/distributions/:id/close', adminAuth, (req, res) => {
  const dist = db.getDistribution(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Non trouvée' });
  db.closeDistribution(req.params.id, Date.now());
  io.to(`dist-${req.params.id}`).emit('distribution-closed');
  res.json({ success: true });
});

// Delete distribution (admin)
app.delete('/api/distributions/:id', adminAuth, (req, res) => {
  db.deleteDistribution(req.params.id);
  res.json({ success: true });
});

// Report data (admin)
app.get('/api/distributions/:id/report', adminAuth, (req, res) => {
  const dist = db.getDistribution(req.params.id);
  if (!dist) return res.status(404).json({ error: 'Non trouvée' });

  const users = db.getDistributionUsers(req.params.id);
  const routes = db.getDistributionRoutes(req.params.id);

  const stats = users.map(u => {
    const userRoute = routes.find(r => r.userId === u.id);
    const allPoints = userRoute ? userRoute.segments.flatMap(s => s.points.map(p => ({ ...p, seg: s.seg }))) : [];

    let distance = 0;
    for (let i = 1; i < allPoints.length; i++) {
      if (allPoints[i].seg === allPoints[i - 1].seg) {
        distance += haversine(allPoints[i - 1].lat, allPoints[i - 1].lon, allPoints[i].lat, allPoints[i].lon);
      }
    }

    const sessions = db.getUserSessions(u.id);
    let duration = 0;
    sessions.forEach(s => { duration += (s.end_time || Date.now()) - s.start_time; });

    return { ...u, distance: Math.round(distance * 1000) / 1000, duration, pointCount: allPoints.length };
  });

  const totalDist = stats.reduce((a, s) => a + s.distance, 0);
  const totalDur = Math.max(...stats.map(s => s.duration), 0);

  res.json({ distribution: dist, users: stats, routes, totalDistance: Math.round(totalDist * 1000) / 1000, totalDuration: totalDur });
});

// Socket.io
io.on('connection', socket => {
  socket.on('join', ({ distributionId }) => {
    socket.join(`dist-${distributionId}`);
  });

  socket.on('location', ({ userId, token, lat, lon, ts }) => {
    const user = db.validateUserToken(userId, token);
    if (!user || user.status !== 'active') return;
    const segment = db.getCurrentSegment(userId);
    db.addLocation({ userId, lat, lon, ts, segment });
    db.updateUserLastSeen(userId, ts);
    io.to(`dist-${user.distribution_id}`).emit('location', { userId, lat, lon, ts, segment });
  });

  socket.on('pause', ({ userId, token }) => {
    const user = db.validateUserToken(userId, token);
    if (!user) return;
    const now = Date.now();
    db.pauseUser(userId, now);
    db.endSession(userId, now);
    io.to(`dist-${user.distribution_id}`).emit('user-status', { userId, status: 'paused' });
  });

  socket.on('resume', ({ userId, token }) => {
    const user = db.validateUserToken(userId, token);
    if (!user) return;
    const now = Date.now();
    db.resumeUser(userId, now);
    db.startSession(userId, now);
    const segment = db.getCurrentSegment(userId);
    io.to(`dist-${user.distribution_id}`).emit('user-status', { userId, status: 'active', segment });
  });

  socket.on('done', ({ userId, token }) => {
    const user = db.validateUserToken(userId, token);
    if (!user) return;
    const now = Date.now();
    db.markUserDone(userId, now);
    db.endSession(userId, now);
    io.to(`dist-${user.distribution_id}`).emit('user-status', { userId, status: 'done' });
  });
});

// Start server after DB is ready
db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`Distribution Tracker → http://localhost:${PORT}`);
    console.log(`Mot de passe admin: ${ADMIN_PASSWORD}`);
  });
}).catch(err => {
  console.error('Erreur initialisation base de données:', err);
  process.exit(1);
});

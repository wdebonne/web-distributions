// Distribution Tracker v1.0.0 — Database layer (sql.js / SQLite WASM)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'tracker.db');
let db = null;

function save() {
  if (!db) return;
  try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); } catch (e) { console.error('DB save error:', e); }
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS distributions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      closed_at INTEGER,
      status TEXT DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS dist_users (
      id TEXT PRIMARY KEY,
      distribution_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      token TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      joined_at INTEGER NOT NULL,
      last_seen INTEGER,
      segment INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      ts INTEGER NOT NULL,
      segment INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER
    );
  `);
  save();

  // Auto-save every 60 seconds
  setInterval(save, 60000);
}

module.exports = {
  init,

  createDistribution({ id, name, description, now }) {
    run('INSERT INTO distributions (id, name, description, created_at) VALUES (?,?,?,?)', [id, name, description, now]);
  },

  getDistributions() {
    return all(`
      SELECT d.id, d.name, d.description, d.created_at, d.closed_at, d.status,
             (SELECT COUNT(*) FROM dist_users WHERE distribution_id = d.id) as user_count
      FROM distributions d ORDER BY d.created_at DESC
    `);
  },

  getDistribution(id) {
    return get('SELECT * FROM distributions WHERE id = ?', [id]);
  },

  closeDistribution(id, now) {
    run('UPDATE distributions SET status=?, closed_at=? WHERE id=?', ['closed', now, id]);
  },

  deleteDistribution(id) {
    const users = all('SELECT id FROM dist_users WHERE distribution_id=?', [id]);
    users.forEach(u => {
      run('DELETE FROM locations WHERE user_id=?', [u.id]);
      run('DELETE FROM sessions WHERE user_id=?', [u.id]);
    });
    run('DELETE FROM dist_users WHERE distribution_id=?', [id]);
    run('DELETE FROM distributions WHERE id=?', [id]);
  },

  createUser({ userId, distributionId, name, color, token, now }) {
    run('INSERT INTO dist_users (id,distribution_id,name,color,token,joined_at) VALUES (?,?,?,?,?,?)',
      [userId, distributionId, name, color, token, now]);
  },

  getUserByName(distributionId, name) {
    return get('SELECT * FROM dist_users WHERE distribution_id=? AND LOWER(name)=LOWER(?)', [distributionId, name]);
  },

  validateUserToken(userId, token) {
    return get('SELECT * FROM dist_users WHERE id=? AND token=?', [userId, token]);
  },

  getTakenColors(distributionId) {
    return all('SELECT color FROM dist_users WHERE distribution_id=?', [distributionId]).map(r => r.color);
  },

  getDistributionUsers(distributionId) {
    return all('SELECT id,name,color,status,joined_at,last_seen FROM dist_users WHERE distribution_id=? ORDER BY joined_at', [distributionId]);
  },

  addLocation({ userId, lat, lon, ts, segment }) {
    run('INSERT INTO locations (user_id,lat,lon,ts,segment) VALUES (?,?,?,?,?)', [userId, lat, lon, ts, segment]);
  },

  getCurrentSegment(userId) {
    const r = get('SELECT segment FROM dist_users WHERE id=?', [userId]);
    return r ? (r.segment || 0) : 0;
  },

  getDistributionRoutes(distributionId) {
    const users = all('SELECT id,name,color FROM dist_users WHERE distribution_id=?', [distributionId]);
    return users.map(u => {
      const locs = all('SELECT lat,lon,ts,segment FROM locations WHERE user_id=? ORDER BY ts', [u.id]);
      const segMap = {};
      locs.forEach(l => {
        const seg = l.segment || 0;
        if (!segMap[seg]) segMap[seg] = [];
        segMap[seg].push({ lat: l.lat, lon: l.lon, ts: l.ts });
      });
      return {
        userId: u.id, name: u.name, color: u.color,
        segments: Object.entries(segMap).map(([s, pts]) => ({ seg: parseInt(s), points: pts }))
      };
    });
  },

  pauseUser(userId, now) {
    run('UPDATE dist_users SET status=?,last_seen=? WHERE id=?', ['paused', now, userId]);
  },

  resumeUser(userId, now) {
    const r = get('SELECT segment FROM dist_users WHERE id=?', [userId]);
    run('UPDATE dist_users SET status=?,segment=?,last_seen=? WHERE id=?',
      ['active', (r ? (r.segment || 0) : 0) + 1, now, userId]);
  },

  markUserDone(userId, now) {
    run('UPDATE dist_users SET status=?,last_seen=? WHERE id=?', ['done', now, userId]);
  },

  updateUserLastSeen(userId, ts) {
    run('UPDATE dist_users SET last_seen=? WHERE id=?', [ts, userId]);
  },

  startSession(userId, now) {
    run('INSERT INTO sessions (user_id,start_time) VALUES (?,?)', [userId, now]);
  },

  endSession(userId, now) {
    run('UPDATE sessions SET end_time=? WHERE user_id=? AND end_time IS NULL', [now, userId]);
  },

  getUserSessions(userId) {
    return all('SELECT * FROM sessions WHERE user_id=? ORDER BY start_time', [userId]);
  }
};

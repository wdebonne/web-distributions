// Distribution Tracker v2.2.0 — Database layer (sql.js / SQLite WASM)
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'tracker.db');
let db = null;

function save() {
  if (!db) return;
  try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); } catch(e) { console.error('DB save:', e.message); }
}

function run(sql, params = []) { db.run(sql, params); save(); }
function get(sql, params = []) {
  const s = db.prepare(sql); s.bind(params);
  const r = s.step() ? s.getAsObject() : null; s.free(); return r;
}
function all(sql, params = []) {
  const s = db.prepare(sql); s.bind(params);
  const rows = []; while (s.step()) rows.push(s.getAsObject()); s.free(); return rows;
}

async function init() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

  // ── Core tables ────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS distributions (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      created_at INTEGER NOT NULL, closed_at INTEGER, status TEXT DEFAULT 'active',
      creator_id TEXT
    );
    CREATE TABLE IF NOT EXISTS dist_users (
      id TEXT PRIMARY KEY, distribution_id TEXT NOT NULL,
      name TEXT NOT NULL, color TEXT NOT NULL, token TEXT NOT NULL,
      status TEXT DEFAULT 'active', joined_at INTEGER NOT NULL,
      last_seen INTEGER, segment INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL,
      ts INTEGER NOT NULL, segment INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL, start_time INTEGER NOT NULL, end_time INTEGER
    );
  `);

  // ── Auth & roles ───────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'creator',
      active INTEGER DEFAULT 1, force_password_change INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, last_login INTEGER,
      reset_token TEXT, reset_expires INTEGER
    );
  `);

  // ── Distribution managers (co-gestion / délégation) ─
  db.run(`
    CREATE TABLE IF NOT EXISTS dist_managers (
      distribution_id TEXT NOT NULL, user_id TEXT NOT NULL,
      type TEXT DEFAULT 'manager',
      added_at INTEGER NOT NULL,
      PRIMARY KEY (distribution_id, user_id)
    );
  `);

  // ── SMTP & Email ───────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS smtp_settings (
      id INTEGER PRIMARY KEY CHECK (id=1),
      host TEXT DEFAULT '', port INTEGER DEFAULT 587, secure INTEGER DEFAULT 0,
      smtp_user TEXT DEFAULT '', smtp_pass TEXT DEFAULT '',
      from_name TEXT DEFAULT 'Distribution Tracker',
      from_email TEXT DEFAULT '', enabled INTEGER DEFAULT 0
    );
    INSERT OR IGNORE INTO smtp_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS email_templates (
      name TEXT PRIMARY KEY, subject TEXT NOT NULL, html TEXT NOT NULL
    );
  `);

  // ── App settings ──────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT ''
    );
  `);
  const SETTING_DEFAULTS = [
    ['site_name',           'Distribution Tracker'],
    ['site_tagline',        'Suivi de distribution de courriers'],
    ['logo_emoji',          '🗺️'],
    ['favicon_url',         ''],
    ['primary_color',       '#1565C0'],
    ['login_gradient_from', '#1565C0'],
    ['login_gradient_to',   '#0D47A1'],
    ['footer_text',         ''],
    ['login_message',       ''],
    // ── Auth externes ──────────────────────────────
    ['auth_mode',           'local'],
    ['ldap_host',           ''],
    ['ldap_port',           '389'],
    ['ldap_use_ssl',        '0'],
    ['ldap_base_dn',        ''],
    ['ldap_bind_dn',        ''],
    ['ldap_bind_password',  ''],
    ['ldap_user_filter',    '(|(mail={{login}})(sAMAccountName={{login}})(uid={{login}}))'],
    ['auth_group_mapping',  '[{"group":"DISTRIB_ADMIN","role":"admin"},{"group":"DISTRIB_CREATEUR","role":"creator"}]'],
    ['sso_url',             ''],
    ['sso_client_id',       ''],
    ['sso_client_secret',   ''],
    ['sso_scope',           'user_info'],
    ['sso_ignore_ssl',      '0'],
    ['sso_default_role',    ''],
  ];
  SETTING_DEFAULTS.forEach(([k, v]) => {
    try { db.run('INSERT OR IGNORE INTO app_settings (key,value) VALUES (?,?)', [k, v]); } catch(e) {}
  });

  // ── Migrations ────────────────────────────────────
  try { db.run('ALTER TABLE distributions ADD COLUMN creator_id TEXT'); } catch(e) {}
  try { db.run('ALTER TABLE dist_users ADD COLUMN steps INTEGER DEFAULT 0'); } catch(e) {}
  try { db.run("ALTER TABLE app_users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'"); } catch(e) {}

  // ── Données par défaut ────────────────────────────
  await ensureDefaultAdmin();
  ensureDefaultTemplates();
  save();

  // Auto-save every 60s
  setInterval(save, 60000);
}

async function ensureDefaultAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@localhost').toLowerCase();
  const pwd   = process.env.ADMIN_PASSWORD || 'admin123';
  const hash  = await bcrypt.hash(pwd, 10);

  // Portainer est la source de vérité : toujours synchroniser le compte admin
  // correspondant à ADMIN_EMAIL avec le mot de passe ADMIN_PASSWORD.
  const existing = get('SELECT id FROM app_users WHERE LOWER(email)=LOWER(?)', [email]);

  if (existing) {
    // Email trouvé — synchroniser uniquement le mot de passe
    db.run('UPDATE app_users SET password_hash=?,role=?,active=1 WHERE id=?', [hash, 'admin', existing.id]);
    db.run('UPDATE distributions SET creator_id=? WHERE creator_id IS NULL', [existing.id]);
    console.log(`✅ Admin synchronisé : ${email}`);
  } else {
    // Aucun compte avec cet email — chercher un admin existant à mettre à jour
    const anyAdmin = get('SELECT id,email FROM app_users WHERE role=? LIMIT 1', ['admin']);
    if (anyAdmin) {
      // Portainer est la source de vérité : mise à jour email + mot de passe
      db.run('UPDATE app_users SET email=?,password_hash=?,active=1 WHERE id=?', [email, hash, anyAdmin.id]);
      db.run('UPDATE distributions SET creator_id=? WHERE creator_id IS NULL', [anyAdmin.id]);
      console.log(`✅ Admin mis à jour : ${anyAdmin.email} → ${email}`);
    } else {
      // Aucun admin du tout — créer le premier compte
      const id = 'admin-' + Date.now();
      db.run('INSERT INTO app_users (id,email,name,password_hash,role,active,created_at) VALUES (?,?,?,?,?,1,?)',
        [id, email, 'Administrateur', hash, 'admin', Date.now()]);
      db.run('UPDATE distributions SET creator_id=? WHERE creator_id IS NULL', [id]);
      console.log(`✅ Admin créé : ${email}`);
    }
  }
}

function ensureDefaultTemplates() {
  const templates = [
    {
      name: 'reset-password',
      subject: '🔑 Réinitialisation de mot de passe — {{app_name}}',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;">
  <div style="background:#1565C0;padding:24px;border-radius:10px 10px 0 0;">
    <h2 style="color:#fff;margin:0;">🗺️ {{app_name}}</h2>
  </div>
  <div style="background:#f5f7fa;padding:28px;border-radius:0 0 10px 10px;border:1px solid #e0e0e0;">
    <p>Bonjour <strong>{{name}}</strong>,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="{{url}}" style="background:#1565C0;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        Réinitialiser mon mot de passe
      </a>
    </p>
    <p style="color:#607D8B;font-size:13px;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
  </div>
</div>`
    },
    {
      name: 'welcome',
      subject: '👋 Bienvenue sur {{app_name}}',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;">
  <div style="background:#1565C0;padding:24px;border-radius:10px 10px 0 0;">
    <h2 style="color:#fff;margin:0;">🗺️ {{app_name}}</h2>
  </div>
  <div style="background:#f5f7fa;padding:28px;border-radius:0 0 10px 10px;border:1px solid #e0e0e0;">
    <p>Bonjour <strong>{{name}}</strong>,</p>
    <p>Votre compte Créateur a été créé sur <strong>{{app_name}}</strong>.</p>
    <table style="background:#E3F2FD;border-radius:8px;padding:16px;width:100%;border-collapse:collapse;">
      <tr><td style="padding:4px 0;color:#607D8B;">Email</td><td><strong>{{email}}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#607D8B;">Mot de passe</td><td><strong>{{password}}</strong></td></tr>
    </table>
    <p style="text-align:center;margin:24px 0;">
      <a href="{{url}}" style="background:#1565C0;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        Se connecter
      </a>
    </p>
    <p style="color:#607D8B;font-size:13px;">Pensez à changer votre mot de passe après votre première connexion.</p>
  </div>
</div>`
    }
  ];
  templates.forEach(t => {
    const exists = get('SELECT name FROM email_templates WHERE name=?', [t.name]);
    if (!exists) db.run('INSERT INTO email_templates (name,subject,html) VALUES (?,?,?)', [t.name, t.subject, t.html]);
  });
}

// ══ Exports ═══════════════════════════════════════════
module.exports = {
  init,

  // ── App users ────────────────────────────────────
  getUserByEmail(email)    { return get('SELECT * FROM app_users WHERE LOWER(email)=LOWER(?)', [email]); },
  getUserById(id)          { return get('SELECT * FROM app_users WHERE id=?', [id]); },
  getUserByResetToken(tok) { return get('SELECT * FROM app_users WHERE reset_token=? AND reset_expires>?', [tok, Date.now()]); },
  getAllUsers()             { return all('SELECT id,email,name,role,active,created_at,last_login FROM app_users ORDER BY role DESC,name'); },
  createAppUser({ id, email, name, role, hash, now, forceChange }) {
    run('INSERT INTO app_users (id,email,name,password_hash,role,active,force_password_change,created_at) VALUES (?,?,?,?,?,1,?,?)',
      [id, email, name, hash, role, forceChange ? 1 : 0, now]);
  },
  updateAppUser(id, { name, role, active, email }) {
    run('UPDATE app_users SET name=?,role=?,active=?,email=? WHERE id=?', [name, role, active, email, id]);
  },
  updateLastLogin(id, ts)        { run('UPDATE app_users SET last_login=? WHERE id=?', [ts, id]); },
  updateUserPassword(id, hash, force = false) {
    run('UPDATE app_users SET password_hash=?,force_password_change=? WHERE id=?', [hash, force ? 1 : 0, id]);
  },
  setResetToken(id, token, exp)  { run('UPDATE app_users SET reset_token=?,reset_expires=? WHERE id=?', [token, exp, id]); },
  clearResetToken(id)            { run('UPDATE app_users SET reset_token=NULL,reset_expires=NULL WHERE id=?', [id]); },
  deleteAppUser(id)              { run('DELETE FROM app_users WHERE id=?', [id]); },

  // Crée ou met à jour un compte provenant de LDAP ou SSO
  upsertExternalUser({ email, name, role, provider }) {
    const existing = get('SELECT * FROM app_users WHERE LOWER(email)=LOWER(?)', [email]);
    if (existing) {
      run('UPDATE app_users SET name=?,role=?,auth_provider=?,active=1,force_password_change=0 WHERE id=?',
        [name, role, provider, existing.id]);
      return existing.id;
    }
    const id = provider + '-' + Date.now();
    run('INSERT INTO app_users (id,email,name,password_hash,role,active,force_password_change,created_at,auth_provider) VALUES (?,?,?,?,?,1,0,?,?)',
      [id, email.trim().toLowerCase(), name, 'EXTERNAL_AUTH_ONLY', role, Date.now(), provider]);
    return id;
  },

  // ── Distributions ─────────────────────────────────
  createDistribution({ id, name, description, now, creatorId }) {
    run('INSERT INTO distributions (id,name,description,created_at,creator_id) VALUES (?,?,?,?,?)',
      [id, name, description, now, creatorId]);
  },
  getDistributions() {
    return all(`SELECT d.*,
      (SELECT COUNT(*) FROM dist_users WHERE distribution_id=d.id) as user_count,
      u.name as creator_name
      FROM distributions d LEFT JOIN app_users u ON d.creator_id=u.id
      ORDER BY d.created_at DESC`);
  },
  getCreatorDistributions(creatorId) {
    return all(`SELECT d.*,
      (SELECT COUNT(*) FROM dist_users WHERE distribution_id=d.id) as user_count
      FROM distributions d
      WHERE d.creator_id=?
         OR EXISTS (SELECT 1 FROM dist_managers WHERE distribution_id=d.id AND user_id=?)
      ORDER BY d.created_at DESC`, [creatorId, creatorId]);
  },
  getDistribution(id)   { return get('SELECT * FROM distributions WHERE id=?', [id]); },
  closeDistribution(id, now) { run('UPDATE distributions SET status=?,closed_at=? WHERE id=?', ['closed', now, id]); },
  reassignDistribution(id, creatorId) { run('UPDATE distributions SET creator_id=? WHERE id=?', [creatorId, id]); },
  deleteDistribution(id) {
    const users = all('SELECT id FROM dist_users WHERE distribution_id=?', [id]);
    users.forEach(u => { run('DELETE FROM locations WHERE user_id=?', [u.id]); run('DELETE FROM sessions WHERE user_id=?', [u.id]); });
    run('DELETE FROM dist_users WHERE distribution_id=?', [id]);
    run('DELETE FROM dist_managers WHERE distribution_id=?', [id]);
    run('DELETE FROM distributions WHERE id=?', [id]);
  },

  // ── Managers / Délégation ─────────────────────────
  isDistManager(distId, userId) {
    return !!get('SELECT 1 FROM dist_managers WHERE distribution_id=? AND user_id=?', [distId, userId]);
  },
  getDistManagers(distId) {
    return all(`SELECT m.*,u.name,u.email,u.role FROM dist_managers m
      JOIN app_users u ON m.user_id=u.id
      WHERE m.distribution_id=?`, [distId]);
  },
  addDistManager(distId, userId, type, now) {
    run('INSERT OR REPLACE INTO dist_managers (distribution_id,user_id,type,added_at) VALUES (?,?,?,?)',
      [distId, userId, type, now]);
  },
  removeDistManager(distId, userId) { run('DELETE FROM dist_managers WHERE distribution_id=? AND user_id=?', [distId, userId]); },
  setDelegate(distId, userId, now) {
    run('DELETE FROM dist_managers WHERE distribution_id=? AND type=?', [distId, 'delegate']);
    run('INSERT OR REPLACE INTO dist_managers (distribution_id,user_id,type,added_at) VALUES (?,?,?,?)',
      [distId, userId, 'delegate', now]);
  },
  removeDelegate(distId) { run('DELETE FROM dist_managers WHERE distribution_id=? AND type=?', [distId, 'delegate']); },

  // ── App settings ─────────────────────────────────
  getSettings() {
    const rows = all('SELECT key,value FROM app_settings');
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
  saveSettings(obj) {
    Object.entries(obj).forEach(([k, v]) => {
      run('INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)', [k, String(v ?? '')]);
    });
  },

  // ── SMTP ──────────────────────────────────────────
  getSmtpSettings()  { return get('SELECT * FROM smtp_settings WHERE id=1'); },
  saveSmtpSettings({ host, port, secure, user, pass, from_name, from_email, enabled }) {
    const current = get('SELECT smtp_pass FROM smtp_settings WHERE id=1');
    const finalPass = pass !== undefined && pass !== '' ? pass : (current?.smtp_pass || '');
    run('UPDATE smtp_settings SET host=?,port=?,secure=?,smtp_user=?,smtp_pass=?,from_name=?,from_email=?,enabled=? WHERE id=1',
      [host || '', port || 587, secure ? 1 : 0, user || '', finalPass, from_name || 'Distribution Tracker', from_email || '', enabled ? 1 : 0]);
  },

  // ── Email templates ───────────────────────────────
  getAllEmailTemplates() { return all('SELECT name,subject,html FROM email_templates ORDER BY name'); },
  getEmailTemplate(name) { return get('SELECT * FROM email_templates WHERE name=?', [name]); },
  saveEmailTemplate(name, subject, html) {
    run('INSERT OR REPLACE INTO email_templates (name,subject,html) VALUES (?,?,?)', [name, subject, html]);
  },

  // ── Distribution users (unchanged) ────────────────
  createUser({ userId, distributionId, name, color, token, now }) {
    run('INSERT INTO dist_users (id,distribution_id,name,color,token,joined_at) VALUES (?,?,?,?,?,?)',
      [userId, distributionId, name, color, token, now]);
  },
  getUserByName(distId, name) { return get('SELECT * FROM dist_users WHERE distribution_id=? AND LOWER(name)=LOWER(?)', [distId, name]); },
  validateUserToken(userId, token) { return get('SELECT * FROM dist_users WHERE id=? AND token=?', [userId, token]); },
  getTakenColors(distId)     { return all('SELECT color FROM dist_users WHERE distribution_id=?', [distId]).map(r => r.color); },
  getDistributionUsers(distId) { return all('SELECT id,name,color,status,joined_at,last_seen,steps FROM dist_users WHERE distribution_id=? ORDER BY joined_at', [distId]); },
  addLocation({ userId, lat, lon, ts, segment }) {
    run('INSERT INTO locations (user_id,lat,lon,ts,segment) VALUES (?,?,?,?,?)', [userId, lat, lon, ts, segment]);
  },
  getCurrentSegment(userId)  { const r = get('SELECT segment FROM dist_users WHERE id=?', [userId]); return r ? (r.segment || 0) : 0; },
  getDistributionRoutes(distId) {
    const users = all('SELECT id,name,color FROM dist_users WHERE distribution_id=?', [distId]);
    return users.map(u => {
      const locs = all('SELECT lat,lon,ts,segment FROM locations WHERE user_id=? ORDER BY ts', [u.id]);
      const seg = {}; locs.forEach(l => { const s = l.segment||0; if (!seg[s]) seg[s]=[]; seg[s].push({lat:l.lat,lon:l.lon,ts:l.ts}); });
      return { userId:u.id, name:u.name, color:u.color, segments:Object.entries(seg).map(([s,pts])=>({seg:parseInt(s),points:pts})) };
    });
  },
  pauseUser(userId, now)  { run('UPDATE dist_users SET status=?,last_seen=? WHERE id=?', ['paused', now, userId]); },
  resumeUser(userId, now) {
    const r = get('SELECT segment FROM dist_users WHERE id=?', [userId]);
    run('UPDATE dist_users SET status=?,segment=?,last_seen=? WHERE id=?', ['active', (r?.segment||0)+1, now, userId]);
  },
  markUserDone(userId, now)      { run('UPDATE dist_users SET status=?,last_seen=? WHERE id=?', ['done', now, userId]); },
  updateUserLastSeen(userId, ts) { run('UPDATE dist_users SET last_seen=? WHERE id=?', [ts, userId]); },
  startSession(userId, now)      { run('INSERT INTO sessions (user_id,start_time) VALUES (?,?)', [userId, now]); },
  endSession(userId, now)        { run('UPDATE sessions SET end_time=? WHERE user_id=? AND end_time IS NULL', [now, userId]); },
  getUserSessions(userId)        { return all('SELECT * FROM sessions WHERE user_id=? ORDER BY start_time', [userId]); },
  updateUserSteps(userId, steps) { run('UPDATE dist_users SET steps=? WHERE id=?', [steps, userId]); }
};

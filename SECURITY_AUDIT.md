# Audit de Sécurité — Distribution Tracker v2.2.0

**Date :** 2026-05-30  
**Auditeur :** Claude Sonnet 4.6  
**Résultat global :** 4 CRITIQUES · 4 HIGH · 4 MEDIUM · 2 LOW

---

## Résumé Exécutif

L'application présente plusieurs vulnérabilités critiques à corriger avant toute mise en production. Les points forts sont la protection contre l'injection SQL (requêtes paramétrées), le hachage bcrypt des mots de passe, et la validation RBAC. Les faiblesses majeures concernent la configuration CORS, la gestion des secrets, et l'absence de headers de sécurité.

---

## 1. Vulnérabilités CRITIQUES

### 1.1 CORS ouvert sur Socket.io (CWE-942)

**Fichier :** `server.js:18`  
**Code vulnérable :**
```javascript
const io = new Server(server, { cors: { origin: '*' } });
```

**Risque :** Tout client peut se connecter au WebSocket, permettant l'interception des données GPS et la manipulation des flux de tracking en temps réel.

**Correction :**
```javascript
const io = new Server(server, {
  cors: {
    origin: process.env.BASE_URL || 'http://localhost:3000',
    credentials: true
  }
});
```

---

### 1.2 JWT Secret codé en dur (CWE-798)

**Fichier :** `server.js:22`  
**Code vulnérable :**
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'dt-dev-secret-change-in-prod';
```

**Risque :** Si `JWT_SECRET` n'est pas défini, n'importe qui connaissant le secret par défaut (visible dans le dépôt) peut forger des tokens valides et accéder à tous les comptes.

**Correction :**
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
```

---

### 1.3 Validation SSL/TLS désactivée (CWE-295)

**Fichiers :** `server.js:67` (LDAP), `server.js:128` (SSO/HTTP), `server.js:252` (SMTP)  
**Code vulnérable :**
```javascript
tlsOptions: { rejectUnauthorized: false }  // LDAP
tls: { rejectUnauthorized: false }          // SMTP
```

**Risque :** Attaques Man-in-the-Middle possibles sur les connexions LDAP, SSO et SMTP. Identifiants et tokens interceptables.

**Correction :**
```javascript
// LDAP
tlsOptions: { rejectUnauthorized: true }

// SMTP
tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false' }
```

---

### 1.4 Génération de mot de passe non cryptographique (CWE-338)

**Fichier :** `server.js:527`  
**Code vulnérable :**
```javascript
const pwd = password || Math.random().toString(36).slice(-10);
```

**Risque :** `Math.random()` n'est pas cryptographiquement sûr (~52 bits d'entropie). Les mots de passe auto-générés peuvent être prédits ou brute-forcés rapidement.

**Correction :**
```javascript
const crypto = require('crypto');
const pwd = password || crypto.randomBytes(16).toString('base64').slice(0, 16);
```

---

## 2. Vulnérabilités HIGH

### 2.1 Absence de rate limiting sur les endpoints d'authentification (CWE-307)

**Fichier :** `server.js:409` (`/api/auth/login`), `server.js:496` (`/api/auth/forgot-password`)

**Risque :** Brute-force de mots de passe, credential stuffing, énumération de comptes, déni de service.

**Correction :**
```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Trop de tentatives de connexion, réessayez plus tard.'
});

app.post('/api/auth/login', loginLimiter, async (req, res) => { ... });
app.post('/api/auth/forgot-password', loginLimiter, async (req, res) => { ... });
```

---

### 2.2 Absence de headers de sécurité HTTP (CWE-693)

**Fichier :** `server.js` (aucun middleware de sécurité configuré)

**Headers manquants :**
- `Content-Security-Policy` (CSP)
- `X-Frame-Options` (protection clickjacking)
- `X-Content-Type-Options` (MIME sniffing)
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection`

**Correction — Option 1 (recommandée) :**
```bash
npm install helmet
```
```javascript
const helmet = require('helmet');
app.use(helmet());
```

**Correction — Option 2 (manuelle) :**
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; font-src 'self' data:;"
  );
  next();
});
```

---

### 2.3 XSS dans le résultat du test LDAP (CWE-79)

**Fichier :** `public/admin.html:1113`  
**Code vulnérable :**
```javascript
let html = `✅ ${d.message}`;  // d.message non échappé
resultEl.innerHTML = html;
```

**Risque :** Un serveur LDAP compromis peut injecter du HTML/JavaScript dans le panneau d'administration.

**Correction :**
```javascript
let html = `✅ ${esc(d.message)}`;
```

---

### 2.4 TLS Nodemailer désactivé (CWE-295)

**Fichier :** `server.js:252`

Identique à la vulnérabilité 1.3 mais spécifique à la configuration SMTP Nodemailer. Voir correction section 1.3.

---

## 3. Vulnérabilités MEDIUM

### 3.1 JWT stocké dans localStorage (CWE-668)

**Fichier :** `public/login.html:448`  
**Code :**
```javascript
localStorage.setItem('authToken', data.token);
```

**Risque :** Si une XSS est exploitée, les tokens JWT peuvent être exfiltrés par un attaquant.

**Correction recommandée :** Utiliser des cookies `httpOnly` (nécessite une modification backend) ou renforcer la CSP pour réduire le risque XSS.

---

### 3.2 Durée de vie JWT trop longue (CWE-613)

**Fichier :** `server.js:222`  
**Code :**
```javascript
jwt.sign({...}, JWT_SECRET, { expiresIn: '7d' });
```

**Risque :** Un token compromis reste valide 7 jours.

**Correction :** Réduire à 1h et implémenter un mécanisme de refresh token.

---

### 3.3 Credentials admin par défaut (CWE-798)

**Fichier :** `.env.example`  
**Valeurs par défaut :**
```
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=admin123
```

**Risque :** Si les valeurs par défaut ne sont pas modifiées en production, le compte admin est accessible avec des identifiants connus publiquement.

**Correction :** Ajouter une vérification au démarrage et documenter clairement l'obligation de changer ces valeurs.

---

### 3.4 Templates email sans sanitisation HTML (CWE-434)

**Fichier :** `server.js:600`

**Risque :** Un admin peut injecter du HTML malveillant dans les templates d'email, conduisant à du phishing.

**Correction :**
```bash
npm install isomorphic-dompurify
```
```javascript
const DOMPurify = require('isomorphic-dompurify');
const sanitizedHtml = DOMPurify.sanitize(html);
```

---

## 4. Vulnérabilités LOW

### 4.1 JSON.parse sans gestion d'erreur (CWE-248)

**Fichier :** `public/admin.html:1058`  
**Code :**
```javascript
if (raw) authGroupMapping = JSON.parse(raw);
```

**Correction :**
```javascript
if (raw) {
  try {
    authGroupMapping = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse mapping:', e);
    authGroupMapping = [];
  }
}
```

---

### 4.2 Absence de limite de taille sur les payloads

**Risque :** Inputs sans validation de longueur maximale, potentiellement exploitables pour de l'épuisement mémoire.

**Correction :**
```javascript
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
```

---

## 5. Points Forts

| Contrôle | Statut |
|---|---|
| Requêtes SQL paramétrées (pas d'injection SQL) | ✅ |
| Hachage bcrypt avec 10 rounds | ✅ |
| Échappement HTML via `esc()` sur la majorité des `innerHTML` | ✅ |
| Contrôle d'accès RBAC bien implémenté | ✅ |
| Tokens de réinitialisation de mot de passe (expiration 1h) | ✅ |
| Validation du paramètre `state` SSO avec expiration | ✅ |
| Protection contre l'injection LDAP | ✅ |

---

## 6. Priorités de Correction

```
CRITIQUES (immédiatement)
├── 1.1  Restreindre CORS Socket.io à BASE_URL
├── 1.2  Rendre JWT_SECRET obligatoire (process.exit si absent)
├── 1.3  Activer rejectUnauthorized sur LDAP/SSO/SMTP
└── 1.4  Remplacer Math.random() par crypto.randomBytes()

HIGH (avant mise en production)
├── 2.1  Ajouter rate limiting sur /api/auth/login et /forgot-password
├── 2.2  Installer helmet et configurer les security headers
└── 2.3  Échapper d.message avec esc() dans admin.html

MEDIUM (prochaine release)
├── 3.1  Migrer JWT vers cookies httpOnly
├── 3.2  Réduire expiration JWT à 1h + refresh tokens
├── 3.3  Forcer le changement des credentials admin par défaut
└── 3.4  Sanitiser les templates email avec DOMPurify

LOW (opportuniste)
├── 4.1  Ajouter try/catch autour des JSON.parse
└── 4.2  Limiter la taille des payloads (express.json limit)
```

---

## 7. Checklist Déploiement Production

- [ ] Définir `JWT_SECRET` avec une valeur aléatoire forte : `openssl rand -hex 32`
- [ ] Modifier `ADMIN_EMAIL` et `ADMIN_PASSWORD` depuis les valeurs par défaut
- [ ] Définir `BASE_URL` avec le domaine de production
- [ ] Activer HTTPS via reverse proxy (nginx/Apache)
- [ ] Configurer le rate limiting sur tous les endpoints d'authentification
- [ ] Activer les security headers (helmet)
- [ ] Restreindre `rejectUnauthorized` uniquement aux environnements de développement
- [ ] Mettre en place une surveillance des tentatives de connexion échouées
- [ ] Configurer les sauvegardes automatiques de la base de données
- [ ] Tester les restrictions CORS avec le domaine frontend réel

# Documentation API — Distribution Tracker v2.0.0

L'API REST est exposée par le serveur Express. Toutes les requêtes et réponses utilisent le format **JSON**.

---

## Authentification

Depuis la v2.0.0, l'API utilise des **tokens JWT** au lieu du mot de passe en header.

### Obtenir un token
```
POST /api/auth/login
```
Retourne un token valable **7 jours**.

### Utiliser le token
Inclure dans toutes les requêtes protégées :
```
Authorization: Bearer <token>
```

### Niveaux d'accès
- 🔒 **Auth** — tout utilisateur connecté (admin ou créateur)
- 🔑 **Admin** — rôle `admin` uniquement
- 🗺️ **Propriétaire** — créateur de la distribution ou co-gérant/délégué
- 🌐 **Public** — aucune authentification requise

---

## Auth

### `POST /api/auth/login`
Connexion par email/mot de passe.

**Body**
```json
{ "email": "aline@exemple.fr", "password": "monMotDePasse" }
```

**Réponse 200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "abc123", "email": "aline@exemple.fr",
    "name": "Aline", "role": "creator",
    "forceChange": false
  }
}
```

| Code | Cause |
|---|---|
| 401 | Email ou mot de passe incorrect / compte désactivé |

---

### `GET /api/auth/me` 🔒
Retourne les informations de l'utilisateur connecté.

**Réponse 200**
```json
{ "id": "abc123", "email": "aline@exemple.fr", "name": "Aline", "role": "creator" }
```

---

### `PUT /api/auth/change-password` 🔒
Change le mot de passe de l'utilisateur connecté.

**Body**
```json
{ "current": "ancien", "newPassword": "nouveau8+" }
```

---

### `POST /api/auth/forgot-password` 🌐
Envoie un email de réinitialisation (répond toujours 200 pour ne pas révéler les emails).

**Body** `{ "email": "aline@exemple.fr" }`

---

### `POST /api/auth/reset-password` 🌐
Réinitialise le mot de passe avec un token reçu par email.

**Body** `{ "token": "abc123...", "newPassword": "nouveau8+" }`

---

## Admin — Utilisateurs

### `GET /api/admin/users` 🔑
Liste tous les utilisateurs.

**Réponse 200**
```json
[{
  "id": "abc123", "email": "aline@exemple.fr", "name": "Aline",
  "role": "creator", "active": 1, "created_at": 1748604000000, "last_login": 1748700000000
}]
```

---

### `POST /api/admin/users` 🔑
Crée un compte utilisateur. Si `password` est omis, un mot de passe est généré.

**Body**
```json
{
  "email": "aline@exemple.fr", "name": "Aline",
  "role": "creator",
  "password": "optionnel",
  "sendWelcome": true
}
```

**Réponse 200**
```json
{ "success": true, "id": "abc123", "generatedPassword": "xyz789abc" }
```

> `generatedPassword` est présent uniquement si le mot de passe a été généré automatiquement.

---

### `PUT /api/admin/users/:id` 🔑
Modifie un compte (nom, rôle, statut actif, email).

**Body** `{ "name": "...", "role": "creator|admin", "active": true, "email": "..." }`

---

### `DELETE /api/admin/users/:id` 🔑
Supprime un compte (impossible de supprimer son propre compte).

---

### `POST /api/admin/users/:id/reset-password` 🔑
Réinitialise le mot de passe d'un utilisateur. Si `newPassword` est omis, génère et retourne un mot de passe.

**Body** `{ "newPassword": "optionnel8+" }`

**Réponse 200** `{ "success": true, "generatedPassword": "xyz789" }`

---

## Admin — SMTP

### `GET /api/admin/smtp` 🔑
Récupère la configuration SMTP (mot de passe masqué `••••••••`).

**Réponse 200**
```json
{
  "host": "smtp.gmail.com", "port": 587, "secure": 0,
  "smtp_user": "user@gmail.com", "smtp_pass": "••••••••",
  "from_name": "Distribution Tracker", "from_email": "noreply@exemple.fr",
  "enabled": 1
}
```

---

### `PUT /api/admin/smtp` 🔑
Sauvegarde la configuration SMTP. Si `pass` est vide ou absent, le mot de passe existant est conservé.

**Body**
```json
{
  "host": "smtp.gmail.com", "port": 587, "secure": false,
  "user": "user@gmail.com", "pass": "nouveau-mdp",
  "from_name": "Distribution Tracker", "from_email": "noreply@exemple.fr",
  "enabled": true
}
```

---

### `POST /api/admin/smtp/test` 🔑
Envoie un email de test.

**Body** `{ "to": "test@exemple.fr" }`

---

## Admin — Templates email

### `GET /api/admin/templates` 🔑
Liste tous les templates email.

**Réponse 200**
```json
[{ "name": "reset-password", "subject": "🔑 Réinitialisation...", "html": "<div>...</div>" }]
```

Templates disponibles :

| Nom | Variables |
|---|---|
| `reset-password` | `name`, `url`, `app_name` |
| `welcome` | `name`, `email`, `password`, `url`, `app_name` |

---

### `PUT /api/admin/templates/:name` 🔑
Met à jour un template. Utiliser `{{variable}}` comme placeholders.

**Body** `{ "subject": "Sujet avec {{app_name}}", "html": "<p>Bonjour {{name}}</p>" }`

---

## Distributions

### `GET /api/distributions` 🔒
- **Admin** : retourne toutes les distributions
- **Créateur** : retourne ses distributions + celles partagées avec lui

**Réponse 200**
```json
[{
  "id": "a1b2c3d4e5", "name": "Journal du Lundi",
  "description": "Secteur Nord", "created_at": 1748604000000,
  "closed_at": null, "status": "active",
  "creator_id": "abc123", "creator_name": "Aline",
  "user_count": 3
}]
```

---

### `POST /api/distributions` 🔒
Crée une distribution. Le créateur est automatiquement l'utilisateur connecté.

**Body** `{ "name": "Journal du Lundi", "description": "Optionnel" }`

**Réponse 200** `{ "id": "a1b2c3d4e5", "name": "...", "url": "https://..." }`

---

### `GET /api/distributions/:id` 🌐
Informations publiques d'une distribution (utilisé par la page distributeur).

**Réponse 200**
```json
{
  "id": "a1b2c3d4e5", "name": "Journal du Lundi", "status": "active",
  "users": [{ "id": "usr_abc", "name": "Aline", "color": "#F44336", "status": "active" }]
}
```

---

### `GET /api/distributions/:id/qr` 🗺️
QR code de la distribution.

**Réponse 200** `{ "qr": "data:image/png;base64,...", "url": "https://..." }`

---

### `POST /api/distributions/:id/close` 🗺️
Clôture la distribution. Déclenche l'événement WebSocket `distribution-closed`.

---

### `DELETE /api/distributions/:id` 🗺️
Supprime la distribution et toutes ses données. Seul le propriétaire ou un admin peut supprimer.

---

### `PUT /api/distributions/:id/reassign` 🔑
Réattribue une distribution à un autre créateur (admin uniquement).

**Body** `{ "creatorId": "nouveau-createur-id" }`

---

### `GET /api/distributions/:id/routes` 🌐
Tracés GPS de tous les participants.

**Réponse 200**
```json
[{
  "userId": "usr_abc", "name": "Aline", "color": "#F44336",
  "segments": [
    { "seg": 0, "points": [{ "lat": 48.856, "lon": 2.352, "ts": 1748604500000 }] }
  ]
}]
```

> Un segment = un trajet continu. Le numéro `seg` incrémente à chaque reprise après pause.

---

### `GET /api/distributions/:id/report` 🗺️
Rapport complet avec statistiques calculées.

**Réponse 200**
```json
{
  "distribution": { "id": "...", "name": "...", "status": "closed" },
  "users": [{
    "id": "usr_abc", "name": "Aline", "color": "#F44336",
    "status": "done", "distance": 4.512, "duration": 7200000, "pointCount": 842
  }],
  "routes": [ /* même format que /routes */ ],
  "totalDistance": 12.847,
  "totalDuration": 18000000
}
```

> `distance` en km (3 décimales) — Haversine  
> `duration` en ms — somme des sessions actives hors pauses

---

## Managers & Délégation

### `GET /api/distributions/:id/managers` 🗺️
Liste les co-gérants et délégués d'une distribution.

**Réponse 200**
```json
[{
  "distribution_id": "a1b2c3d4e5", "user_id": "abc123",
  "type": "delegate", "added_at": 1748700000000,
  "name": "Didier", "email": "didier@exemple.fr", "role": "creator"
}]
```

Types : `delegate` (gestion complète) | `manager` (co-gérant)

---

### `POST /api/distributions/:id/managers` 🗺️
Ajoute un co-gérant ou un délégué.

**Body** `{ "userId": "abc123", "type": "manager|delegate" }`

> Pour la délégation (`type: "delegate"`), l'ancien délégué est automatiquement remplacé.

---

### `DELETE /api/distributions/:id/managers/:userId` 🗺️
Retire un co-gérant ou délégué.

---

## Rejoindre une distribution

### `POST /api/distributions/:id/join` 🌐
Utilisé par la page distributeur (sans compte). Si le nom existe déjà, la session est restaurée.

**Body** `{ "name": "Aline", "color": "#F44336" }`

**Réponse 200**
```json
{
  "userId": "usr_abc123", "token": "tok_xyz789",
  "color": "#F44336", "name": "Aline", "isExisting": false
}
```

| Code | Cause |
|---|---|
| 400 | Distribution clôturée / couleur déjà prise / nom requis |
| 404 | Distribution non trouvée |

---

## WebSocket (Socket.io)

Connexion sur la même URL que l'application.

### Événements client → serveur

| Événement | Payload | Description |
|---|---|---|
| `join` | `{ distributionId }` | Rejoindre la room |
| `location` | `{ userId, token, lat, lon, ts }` | Position GPS |
| `pause` | `{ userId, token }` | Mettre en pause |
| `resume` | `{ userId, token }` | Reprendre |
| `done` | `{ userId, token }` | Terminer |

### Événements serveur → clients

| Événement | Payload | Description |
|---|---|---|
| `user-joined` | `{ id, name, color, status, joinedAt }` | Nouveau participant |
| `location` | `{ userId, lat, lon, ts, segment }` | Position d'un participant |
| `user-status` | `{ userId, status, segment? }` | Changement de statut |
| `distribution-closed` | *(vide)* | Distribution clôturée |

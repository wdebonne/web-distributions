# Documentation API — Distribution Tracker v1.0.0

L'API REST est exposée par le serveur Express. Toutes les requêtes et réponses utilisent le format **JSON**.

---

## Authentification

Les routes admin nécessitent le header suivant :

```
x-admin-pwd: <ADMIN_PASSWORD>
```

ou en query string : `?pwd=<ADMIN_PASSWORD>`

Les routes publiques (rejoindre une distribution, voir les routes) ne nécessitent pas d'authentification.

---

## Distributions

### `POST /api/admin/login`
Vérifie le mot de passe admin.

**Body**
```json
{ "password": "admin123" }
```

**Réponse 200**
```json
{ "success": true, "token": "admin123" }
```

**Réponse 401**
```json
{ "error": "Mot de passe incorrect" }
```

---

### `POST /api/distributions` 🔒
Crée une nouvelle distribution.

**Body**
```json
{
  "name": "Journal du Lundi",
  "description": "Secteur Nord — 120 boîtes"
}
```

**Réponse 201**
```json
{
  "id": "a1b2c3d4e5",
  "name": "Journal du Lundi",
  "url": "http://localhost:3000/distribution.html?id=a1b2c3d4e5"
}
```

---

### `GET /api/distributions` 🔒
Liste toutes les distributions.

**Réponse 200**
```json
[
  {
    "id": "a1b2c3d4e5",
    "name": "Journal du Lundi",
    "description": "Secteur Nord",
    "created_at": 1748604000000,
    "closed_at": null,
    "status": "active",
    "user_count": 3
  }
]
```

---

### `GET /api/distributions/:id`
Récupère une distribution et ses participants. **Route publique.**

**Réponse 200**
```json
{
  "id": "a1b2c3d4e5",
  "name": "Journal du Lundi",
  "description": "Secteur Nord",
  "created_at": 1748604000000,
  "closed_at": null,
  "status": "active",
  "users": [
    {
      "id": "usr_abc123",
      "name": "Aline",
      "color": "#F44336",
      "status": "active",
      "joined_at": 1748604500000,
      "last_seen": 1748606000000
    }
  ]
}
```

**Statuts distribution :** `active` | `closed`  
**Statuts utilisateur :** `active` | `paused` | `done`

---

### `GET /api/distributions/:id/qr` 🔒
Génère le QR code de la distribution.

**Réponse 200**
```json
{
  "qr": "data:image/png;base64,iVBORw...",
  "url": "http://localhost:3000/distribution.html?id=a1b2c3d4e5"
}
```

---

### `POST /api/distributions/:id/close` 🔒
Clôture une distribution. Déclenche l'événement WebSocket `distribution-closed`.

**Réponse 200**
```json
{ "success": true }
```

---

### `DELETE /api/distributions/:id` 🔒
Supprime définitivement une distribution et toutes ses données (participants, routes, sessions).

**Réponse 200**
```json
{ "success": true }
```

---

## Participants

### `POST /api/distributions/:id/join`
Rejoint une distribution en tant qu'utilisateur. **Route publique.**

Si le nom existe déjà, la session existante est retournée (`isExisting: true`).

**Body**
```json
{
  "name": "Aline",
  "color": "#F44336"
}
```

**Réponse 200 — Nouvel utilisateur**
```json
{
  "userId": "usr_abc123def456",
  "token": "tok_xyz789...",
  "color": "#F44336",
  "name": "Aline",
  "isExisting": false
}
```

**Réponse 200 — Session existante**
```json
{
  "userId": "usr_abc123def456",
  "token": "tok_xyz789...",
  "color": "#F44336",
  "name": "Aline",
  "isExisting": true
}
```

**Erreurs**
```json
{ "error": "Distribution non trouvée" }         // 404
{ "error": "Cette distribution est clôturée" }  // 400
{ "error": "Le nom est requis" }                // 400
{ "error": "La couleur est requise" }           // 400
{ "error": "Cette couleur est déjà utilisée" }  // 400
```

---

## Routes (tracés GPS)

### `GET /api/distributions/:id/routes`
Retourne tous les tracés GPS d'une distribution. **Route publique.**

**Réponse 200**
```json
[
  {
    "userId": "usr_abc123def456",
    "name": "Aline",
    "color": "#F44336",
    "segments": [
      {
        "seg": 0,
        "points": [
          { "lat": 48.8566, "lon": 2.3522, "ts": 1748604500000 },
          { "lat": 48.8570, "lon": 2.3530, "ts": 1748604510000 }
        ]
      },
      {
        "seg": 1,
        "points": [
          { "lat": 48.8575, "lon": 2.3540, "ts": 1748605200000 }
        ]
      }
    ]
  }
]
```

> Les segments sont séparés par les pauses. Le numéro `seg` incrémente à chaque reprise.

---

## Rapport

### `GET /api/distributions/:id/report` 🔒
Retourne le rapport complet d'une distribution avec statistiques calculées.

**Réponse 200**
```json
{
  "distribution": {
    "id": "a1b2c3d4e5",
    "name": "Journal du Lundi",
    "created_at": 1748604000000,
    "status": "closed"
  },
  "users": [
    {
      "id": "usr_abc123def456",
      "name": "Aline",
      "color": "#F44336",
      "status": "done",
      "distance": 4.512,
      "duration": 7200000,
      "pointCount": 842
    }
  ],
  "routes": [ /* même format que /routes */ ],
  "totalDistance": 12.847,
  "totalDuration": 18000000
}
```

> `distance` en kilomètres (3 décimales) — calculé avec la formule **Haversine**  
> `duration` en millisecondes — somme des sessions actives (hors pauses)

---

## WebSocket (Socket.io)

Connexion sur la même URL que l'application (`/`).

### Événements client → serveur

| Événement | Payload | Description |
|---|---|---|
| `join` | `{ distributionId }` | Rejoindre la room d'une distribution |
| `location` | `{ userId, token, lat, lon, ts }` | Envoyer une position GPS |
| `pause` | `{ userId, token }` | Mettre en pause |
| `resume` | `{ userId, token }` | Reprendre après une pause |
| `done` | `{ userId, token }` | Marquer la distribution comme terminée |

### Événements serveur → clients

| Événement | Payload | Description |
|---|---|---|
| `user-joined` | `{ id, name, color, status, joinedAt }` | Nouveau participant |
| `location` | `{ userId, lat, lon, ts, segment }` | Nouvelle position GPS d'un participant |
| `user-status` | `{ userId, status, segment? }` | Changement de statut (pause/reprise/fin) |
| `distribution-closed` | *(vide)* | Distribution clôturée par l'admin |

### Exemple d'utilisation

```javascript
const socket = io();

// Rejoindre la room
socket.emit('join', { distributionId: 'a1b2c3d4e5' });

// Envoyer une position
socket.emit('location', {
  userId: 'usr_abc123',
  token:  'tok_xyz789',
  lat:    48.8566,
  lon:    2.3522,
  ts:     Date.now()
});

// Écouter les mises à jour
socket.on('location', ({ userId, lat, lon, segment }) => {
  console.log(`${userId} est en (${lat}, ${lon}) segment ${segment}`);
});
```

---

## Modèles de données

### Distribution
| Champ | Type | Description |
|---|---|---|
| `id` | `string` | Identifiant unique (10 chars hex) |
| `name` | `string` | Nom de la distribution |
| `description` | `string` | Description optionnelle |
| `created_at` | `number` | Timestamp de création (ms) |
| `closed_at` | `number\|null` | Timestamp de clôture (ms) |
| `status` | `string` | `active` ou `closed` |

### Utilisateur
| Champ | Type | Description |
|---|---|---|
| `id` | `string` | Identifiant unique (16 chars hex) |
| `distribution_id` | `string` | ID de la distribution |
| `name` | `string` | Nom/équipe du participant |
| `color` | `string` | Couleur hex (ex: `#F44336`) |
| `token` | `string` | Token d'authentification (32 chars hex) |
| `status` | `string` | `active`, `paused`, ou `done` |
| `segment` | `number` | Numéro du segment courant (incrémente à chaque reprise) |
| `joined_at` | `number` | Timestamp d'inscription (ms) |
| `last_seen` | `number\|null` | Dernière position reçue (ms) |

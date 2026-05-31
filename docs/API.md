# Documentation API — Distribution Tracker v2.3.0

L'API REST est exposée par le serveur Express. Toutes les requêtes et réponses utilisent le format **JSON**.

---

## Authentification

L'API utilise des **tokens JWT** au lieu du mot de passe en header.

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

## Authentification externe *(v2.2)*

### `GET /api/auth/config` 🌐
Retourne les méthodes d'authentification actives (sans credentials). Utilisé par la page de connexion pour afficher ou masquer le bouton SSO et le formulaire.

**Réponse 200**
```json
{
  "localEnabled": true,
  "ssoEnabled": true,
  "ldapEnabled": true,
  "mode": "ldap+sso+local"
}
```

| Champ | Description |
|---|---|
| `localEnabled` | `true` si le formulaire email/mot de passe est actif (local ou LDAP) |
| `ssoEnabled` | `true` si le bouton SSO doit être affiché |
| `ldapEnabled` | `true` si LDAP est actif |
| `mode` | Combinaison active : `local`, `ldap`, `ldap+local`, `sso`, `sso+local`, `ldap+sso`, `ldap+sso+local` |

---

### `GET /api/auth/sso` 🌐
Démarre le flux OAuth2 SSO — redirige vers le serveur Synology SSO.

| Code | Cause |
|---|---|
| 302 | Redirection vers l'URL d'autorisation Synology SSO |
| 400 | SSO non configuré (URL ou Client ID manquant) |

---

### `GET /api/auth/sso/callback` 🌐
Callback OAuth2 appelé par Synology SSO Server après authentification. Usage interne — ne pas appeler directement.

Redirige vers `/sso-callback.html?token=JWT&role=...` en cas de succès, ou vers `/login.html?sso_error=...` en cas d'échec.

---

### `GET /api/admin/auth` 🔑
Récupère la configuration d'authentification (secrets masqués `••••••••`).

**Réponse 200**
```json
{
  "auth_mode": "ldap+sso+local",
  "ldap_host": "192.168.1.10",
  "ldap_port": "389",
  "ldap_use_ssl": "0",
  "ldap_base_dn": "DC=mondomaine,DC=local",
  "ldap_bind_dn": "CN=svc-distrib,CN=Users,DC=mondomaine,DC=local",
  "ldap_bind_password": "••••••••",
  "ldap_user_filter": "(|(mail={{login}})(sAMAccountName={{login}})(uid={{login}}))",
  "auth_group_mapping": "[{\"group\":\"DISTRIB_ADMIN\",\"role\":\"admin\"},{\"group\":\"DISTRIB_CREATEUR\",\"role\":\"creator\"}]",
  "sso_url": "https://nas.mondomaine.local:5001",
  "sso_client_id": "abc123",
  "sso_client_secret": "••••••••",
  "sso_scope": "user_info",
  "sso_ignore_ssl": "0",
  "sso_default_role": ""
}
```

---

### `PUT /api/admin/auth` 🔑
Sauvegarde la configuration d'authentification. Si un secret vaut `••••••••`, la valeur existante est conservée.

**Body** : mêmes champs que la réponse GET, avec les valeurs à modifier.

**`auth_mode`** — combinaison de méthodes actives (séparées par `+`) :

| Valeur | Effet |
|---|---|
| `local` | Formulaire email/mot de passe uniquement |
| `ldap` | LDAP uniquement, pas de fallback local |
| `ldap+local` | LDAP en priorité, local en secours |
| `sso` | Bouton SSO uniquement, formulaire masqué |
| `sso+local` | Bouton SSO + formulaire local |
| `ldap+sso` | LDAP (formulaire) + bouton SSO, pas de local |
| `ldap+sso+local` | Les trois méthodes actives simultanément |

---

### `POST /api/admin/auth/test-ldap` 🔑
Teste la connexion LDAP avec les paramètres fournis.

**Body**
```json
{
  "host": "192.168.1.10", "port": "389", "useSSL": false,
  "bindDn": "CN=svc,CN=Users,DC=domain,DC=local", "bindPassword": "secret",
  "baseDn": "DC=domain,DC=local",
  "filter": "(|(mail={{login}})(sAMAccountName={{login}}))",
  "testLogin": "user@domain.local"
}
```

**Réponse 200**
```json
{
  "connected": true,
  "message": "Connexion au serveur LDAP réussie",
  "userFound": true,
  "userDn": "CN=John,CN=Users,DC=domain,DC=local",
  "userEmail": "john@domain.local",
  "userName": "John Doe",
  "memberOf": ["CN=DISTRIB_ADMIN,CN=Users,DC=domain,DC=local"]
}
```

---

### `POST /api/admin/auth/test-sso` 🔑
Vérifie l'accessibilité du serveur Synology SSO.

**Body** `{ "url": "https://nas:5001", "clientId": "abc", "ignoreSSL": true }`

**Réponse 200** `{ "connected": true, "message": "Serveur SSO Synology accessible", "status": 200 }`

---

## Paramètres du site *(v2.1)*

### `GET /api/settings` 🌐
Retourne les paramètres publics du site (branding, couleurs, message de connexion).

**Réponse 200**
```json
{
  "site_name": "Distribution Tracker",
  "site_tagline": "Suivi de distribution de courriers",
  "logo_emoji": "🗺️",
  "favicon_url": "",
  "primary_color": "#1565C0",
  "login_gradient_from": "#1565C0",
  "login_gradient_to": "#0D47A1",
  "footer_text": "",
  "login_message": ""
}
```

---

### `GET /api/admin/settings` 🔑
Retourne tous les paramètres du site (identique au endpoint public pour l'instant).

---

### `PUT /api/admin/settings` 🔑
Sauvegarde les paramètres du site.

**Body**
```json
{
  "site_name": "Mon Site",
  "site_tagline": "Mon slogan",
  "logo_emoji": "📬",
  "favicon_url": "https://exemple.fr/favicon.ico",
  "primary_color": "#1976D2",
  "login_gradient_from": "#1976D2",
  "login_gradient_to": "#0D47A1",
  "footer_text": "Mon Site v1.0",
  "login_message": "Bienvenue sur notre plateforme !"
}
```

Tous les champs sont optionnels — seuls les champs présents sont mis à jour.

**Réponse 200** `{ "success": true }`

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
    "status": "done", "distance": 4.512, "duration": 7200000,
    "pointCount": 842, "steps": 6240
  }],
  "routes": [ /* même format que /routes */ ],
  "totalDistance": 12.847,
  "totalDuration": 18000000,
  "totalSteps": 18720
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
| `steps` | `{ userId, token, steps }` | Nombre de pas (podomètre) |

### Événements serveur → clients

| Événement | Payload | Description |
|---|---|---|
| `user-joined` | `{ id, name, color, status, joinedAt }` | Nouveau participant |
| `location` | `{ userId, lat, lon, ts, segment }` | Position d'un participant |
| `user-status` | `{ userId, status, segment? }` | Changement de statut |
| `distribution-closed` | *(vide)* | Distribution clôturée |

---

## Schéma base de données

| Table | Description |
|---|---|
| `distributions` | Distributions avec créateur et statut |
| `dist_users` | Participants (sans compte) |
| `locations` | Points GPS par segment |
| `sessions` | Sessions de suivi (pour la durée) |
| `app_users` | Comptes Admin/Créateur |
| `dist_managers` | Co-gérants et délégués |
| `smtp_settings` | Configuration email |
| `email_templates` | Templates bienvenue / réinitialisation |
| `app_settings` | Paramètres du site (branding, couleurs, auth LDAP/SSO) *(v2.1/v2.2)* |

# Guide de déploiement — Distribution Tracker v2.1.0

---

## Prérequis

- **Docker** ≥ 24 et **Docker Compose** ≥ 2.x
- Ou **Node.js** ≥ 18 (développement local)
- Accès réseau au serveur cible
- Un nom de domaine ou IP fixe (pour les QR codes)
- **HTTPS recommandé** — requis par les navigateurs mobiles pour accéder au GPS

---

## 1. Déploiement Docker Compose (recommandé)

### Préparer le répertoire de données (une seule fois)

```bash
# Sur le serveur hôte — à faire avant le premier démarrage
mkdir -p /opt/web-distributions/data
```

> ⚠️ Cette étape est **obligatoire**. Le bind mount `docker-compose.yml` pointe sur ce répertoire.
> Les données SQLite y sont stockées et survivent à tout redéploiement.

### Cloner et configurer

```bash
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions
cp .env.example .env
nano .env
```

### Lancer

```bash
docker compose up -d
docker compose logs -f distribution-tracker
```

---

## 2. Déploiement via Portainer + Git (mises à jour automatiques)

### 2.1 Créer le répertoire de données sur l'hôte

```bash
mkdir -p /opt/web-distributions/data
```

### 2.2 Créer le stack depuis Git

1. Portainer → **Stacks** → **+ Add stack**
2. Choisir **Repository**
3. Renseigner :
   - **Repository URL** : `https://github.com/wdebonne/web-distributions`
   - **Reference** : `refs/heads/main`
   - **Compose path** : `docker-compose.yml`

4. Dans **Environment variables**, ajouter :

   | Nom | Valeur requise |
   |---|---|
   | `PORT` | ex : `3078` |
   | `ADMIN_EMAIL` | Email du compte admin initial |
   | `ADMIN_PASSWORD` | Mot de passe admin initial (changer après connexion) |
   | `JWT_SECRET` | Chaîne aléatoire longue (ex: `openssl rand -hex 32`) |
   | `BASE_URL` | `https://distrib.mondomaine.fr` |

5. Cliquer **Deploy the stack**

> **Premier démarrage** : si aucun compte admin n'existe, un compte est créé avec `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Ces variables ne sont utilisées qu'une seule fois.

### 2.3 Mises à jour automatiques

**Option A — Auto-update par polling** (plus simple) :
- Portainer → Stack → **Auto update** → activer, intervalle : `5m`

**Option B — Webhook GitHub** (instantané) :
1. Portainer → Stack → **Setup webhook** → copier l'URL
2. GitHub → repo → **Settings** → **Webhooks** → coller l'URL
3. Désormais, chaque `git push main` met à jour le container automatiquement

---

## 3. Variables d'environnement complètes

| Variable | Défaut | Requis | Description |
|---|---|---|---|
| `PORT` | `3000` | Non | Port d'écoute HTTP |
| `ADMIN_EMAIL` | `admin@localhost` | **Prod** | Email du 1er compte admin |
| `ADMIN_PASSWORD` | `admin123` | **Prod** | Mot de passe du 1er compte admin |
| `JWT_SECRET` | *(valeur dev)* | **Prod** | Clé secrète JWT — générer avec `openssl rand -hex 32` |
| `BASE_URL` | *(auto)* | En prod | URL publique complète (sans `/` final) |
| `DATA_DIR` | `/data` | Non | Répertoire SQLite dans le container |
| `NODE_ENV` | `production` | Non | Environnement Node.js |

---

## 4. Reverse proxy HTTPS (recommandé)

Le GPS mobile **nécessite HTTPS**. Utiliser Nginx Proxy Manager ou Traefik.

### Nginx Proxy Manager

1. **Proxy Host** :
   - Domain : `distrib.mondomaine.fr`
   - Forward Hostname : `distribution-tracker` (nom du container)
   - Forward Port : `3000` (ou le PORT configuré)
2. Activer **SSL** (Let's Encrypt)
3. Activer **WebSocket support** (requis pour Socket.io)
4. Mettre à jour `BASE_URL=https://distrib.mondomaine.fr`

### Traefik (labels docker-compose)

```yaml
services:
  distribution-tracker:
    # ... config existante ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.distrib.rule=Host(`distrib.mondomaine.fr`)"
      - "traefik.http.routers.distrib.entrypoints=websecure"
      - "traefik.http.routers.distrib.tls.certresolver=letsencrypt"
      - "traefik.http.services.distrib.loadbalancer.server.port=3000"
```

---

## 5. Persistance des données

Les données sont dans `/opt/web-distributions/data/tracker.db` sur l'hôte.

### Sauvegarde

```bash
cp /opt/web-distributions/data/tracker.db \
   /opt/web-distributions/data/backup-$(date +%Y%m%d-%H%M).db
```

### Sauvegarde automatique (cron)

```bash
# Sauvegarder chaque nuit à 2h, garder 30 jours
0 2 * * * cp /opt/web-distributions/data/tracker.db /opt/web-distributions/backups/tracker-$(date +\%Y\%m\%d).db && find /opt/web-distributions/backups -name "*.db" -mtime +30 -delete
```

### Restaurer

```bash
# Arrêter le container
docker compose stop distribution-tracker

# Restaurer
cp /opt/web-distributions/backups/tracker-20260530.db \
   /opt/web-distributions/data/tracker.db

# Redémarrer
docker compose start distribution-tracker
```

---

## 6. Mise à jour manuelle

```bash
cd web-distributions
git pull origin main
docker compose up -d --build
```

> Les données sont dans `/opt/web-distributions/data` sur l'hôte et ne sont **jamais** affectées par une mise à jour.

---

## 7. Développement local

```bash
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions
npm install
cp .env.example .env
npm start
# → http://localhost:3000
# Compte admin créé : admin@localhost / admin123
```

---

## 8. Logs et diagnostics

```bash
# Logs en temps réel
docker compose logs -f

# Dernières 200 lignes
docker compose logs --tail=200 distribution-tracker

# Vérifier que le serveur répond
curl http://localhost:3000/
```

---

## 9. Checklist de sécurité production

- [ ] `ADMIN_PASSWORD` changé après la première connexion
- [ ] `JWT_SECRET` défini avec `openssl rand -hex 32`
- [ ] `BASE_URL` pointe vers HTTPS
- [ ] HTTPS activé (Nginx Proxy Manager ou Traefik)
- [ ] Sauvegarde automatique configurée
- [ ] `ADMIN_EMAIL` pointe vers une adresse réelle si SMTP configuré

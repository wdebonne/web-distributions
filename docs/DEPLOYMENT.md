# Guide de déploiement — Distribution Tracker v1.0.0

---

## Prérequis

- **Docker** ≥ 24 et **Docker Compose** ≥ 2.x
- Ou **Node.js** ≥ 18 (pour le développement local)
- Accès réseau au serveur cible
- Un nom de domaine ou IP fixe (pour les QR codes)

---

## 1. Déploiement Docker Compose (recommandé)

### Cloner le dépôt

```bash
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions
```

### Configurer l'environnement

```bash
cp .env.example .env
# Éditer .env avec vos valeurs
nano .env
```

Variables importantes :

```env
ADMIN_PASSWORD=MonMotDePasseSécurisé!
BASE_URL=https://distrib.mondomaine.fr
PORT=3000
```

### Lancer

```bash
docker compose up -d
```

### Vérifier

```bash
docker compose ps
docker compose logs -f distribution-tracker
```

L'application est accessible sur `http://[IP-serveur]:3000`.

---

## 2. Déploiement via Portainer + Git (mises à jour automatiques)

C'est la méthode recommandée pour faciliter les mises à jour.

### 2.1 Créer le stack depuis Git

1. Dans Portainer → **Stacks** → **+ Add stack**
2. Choisir **Repository**
3. Renseigner :
   - **Repository URL** : `https://github.com/wdebonne/web-distributions`
   - **Reference** : `refs/heads/main`
   - **Compose path** : `docker-compose.yml`

4. Dans **Environment variables**, ajouter :

   | Nom | Valeur |
   |---|---|
   | `ADMIN_PASSWORD` | *votre mot de passe* |
   | `BASE_URL` | `https://distrib.mondomaine.fr` |
   | `PORT` | `3000` |

5. Cliquer **Deploy the stack**

### 2.2 Activer les mises à jour automatiques

Dans Portainer, sur le stack créé :
- Activer **Auto update** → **Polling** (ex: toutes les 5 minutes)  
- Ou configurer un **webhook** pour déclencher la mise à jour à chaque `git push`

**Avec webhook :**
1. Portainer → Stack → **Setup webhook** → copier l'URL
2. GitHub → repo → **Settings** → **Webhooks** → coller l'URL

Désormais, chaque `git push main` met à jour le container automatiquement.

---

## 3. Mise à jour manuelle

```bash
# Sur le serveur
cd web-distributions
git pull origin main
docker compose up -d --build
```

> Les données SQLite sont persistées dans le volume Docker `distribution-data` — elles ne sont **pas** perdues lors d'une mise à jour.

---

## 4. Reverse proxy (HTTPS recommandé)

Pour exposer l'application sur un domaine avec HTTPS, utilisez **Nginx Proxy Manager** ou **Traefik**.

### Exemple avec Nginx Proxy Manager

1. Créer un **Proxy Host** :
   - Domain : `distrib.mondomaine.fr`
   - Forward Hostname : `distribution-tracker` (nom du container)
   - Forward Port : `3000`
   - Activer **SSL** (Let's Encrypt)

2. Activer **WebSocket support** (requis pour Socket.io)

3. Mettre à jour `BASE_URL` dans le stack Portainer :
   ```
   BASE_URL=https://distrib.mondomaine.fr
   ```

### Exemple avec Traefik (labels docker-compose)

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

## 5. Variables d'environnement complètes

| Variable | Défaut | Requis | Description |
|---|---|---|---|
| `PORT` | `3000` | Non | Port d'écoute HTTP |
| `ADMIN_PASSWORD` | `admin123` | **Oui** | Mot de passe admin — à changer ! |
| `BASE_URL` | *(auto)* | En prod | URL publique complète (sans `/` final) |
| `DATA_DIR` | `./data` | Non | Répertoire de la base SQLite |
| `NODE_ENV` | `production` | Non | Environnement Node.js |

---

## 6. Sauvegarde des données

Les données sont dans le volume Docker `distribution-data`.

### Exporter la sauvegarde

```bash
docker run --rm \
  -v distribution-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz /data
```

### Restaurer une sauvegarde

```bash
docker run --rm \
  -v distribution-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/backup-20260530.tar.gz -C /
```

---

## 7. Développement local

```bash
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions
npm install
cp .env.example .env
npm start
# → http://localhost:3000
```

Pour le rechargement automatique :

```bash
npm install -g nodemon
nodemon server.js
```

---

## 8. Health check

```bash
curl http://localhost:3000/
# → doit retourner du HTML
```

Ou via Docker :

```bash
docker compose ps
# STATUS doit être "Up (healthy)"
```

---

## 9. Logs

```bash
# Logs en temps réel
docker compose logs -f

# Dernières 100 lignes
docker compose logs --tail=100 distribution-tracker
```

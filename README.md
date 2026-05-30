# 🗺️ Distribution Tracker

> Application web de suivi GPS en temps réel pour la distribution de courriers en boîtes aux lettres.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](docs/DEPLOYMENT.md)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

---

## ✨ Fonctionnalités

### 👷 Côté utilisateur (mobile)
- Rejoindre une distribution via **QR code** ou lien direct
- Choisir son nom et sa **couleur** de traçage sur la carte
- **Suivi GPS en temps réel** de son parcours (rues, routes tracées)
- **Pause** du suivi (pause repas, fin de journée) — les segments non terminés ne restent pas marqués
- Voir les **routes des autres participants** sur la carte (activable/désactivable)
- Indicateur GPS (précision du signal)
- Reprise de session après fermeture du navigateur

### 🖥️ Côté admin
- **Tableau de bord** pour gérer les distributions
- Créer une distribution → **QR code** + lien générés automatiquement
- **Carte en temps réel** avec les tracés colorés de chaque participant
- Voir le statut de chaque utilisateur (actif, en pause, terminé)
- **Clôturer** une distribution
- **Rapport** filtrable : distance, durée, points GPS, statut par utilisateur
- **Export PDF** du rapport (A4) avec tableau de statistiques

### 🏗️ Technique
- Temps réel via **WebSockets** (Socket.io)
- Cartes **OpenStreetMap** + Leaflet.js (aucune clé API requise)
- Base de données **SQLite** embarquée (sql.js — aucune compilation native)
- **100 % responsive** : PC, tablette, mobile
- Déploiement via **Docker** / **Portainer + Git**

---

## 🚀 Démarrage rapide

### Avec Docker (recommandé)

```bash
# Cloner le dépôt
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions

# Copier et adapter la configuration
cp .env.example .env

# Lancer
docker compose up -d

# Accéder à l'application
open http://localhost:3000
```

### En local (développement)

```bash
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions
npm install
npm start
# → http://localhost:3000
```

> **Mot de passe admin par défaut :** `admin123`  
> À changer impérativement via la variable d'environnement `ADMIN_PASSWORD`.

---

## ⚙️ Configuration

Copier `.env.example` en `.env` et adapter les valeurs :

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute du serveur |
| `ADMIN_PASSWORD` | `admin123` | Mot de passe du panneau admin |
| `BASE_URL` | *(auto-détecté)* | URL publique pour les QR codes (ex: `https://distrib.mondomaine.fr`) |
| `DATA_DIR` | `./data` | Répertoire de stockage SQLite |

---

## 📖 Utilisation

### 1. Créer une distribution

1. Aller sur `http://[votre-serveur]/` → se connecter avec le mot de passe admin
2. Cliquer **+ Créer** → saisir le nom (ex : *Journal du Lundi*)
3. Un **QR code** et un **lien** sont générés automatiquement

### 2. Partager avec les distributeurs

- Afficher le QR code sur un écran ou l'imprimer
- Chaque distributeur scanne le code avec son téléphone

### 3. Suivi en direct

- Admin : cliquer **🗺️ Suivi live** pour voir la carte en temps réel
- Les tracés s'affichent en couleur pour chaque participant

### 4. Rapport

- Admin : cliquer **📊 Rapport** pour voir les statistiques
- Filtrer les colonnes puis **📄 Exporter PDF**

---

## 🗂️ Structure du projet

```
web-distributions/
├── server.js              # Serveur Express + Socket.io
├── database.js            # Couche SQLite (sql.js)
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── API.md             # Documentation de l'API REST + WebSocket
│   ├── DEPLOYMENT.md      # Guide de déploiement complet
│   └── CONTRIBUTING.md    # Guide de contribution
└── public/
    ├── admin.html         # Tableau de bord admin
    ├── track.html         # Carte de suivi temps réel (admin)
    ├── report.html        # Rapports et export PDF
    ├── distribution.html  # Interface utilisateur (GPS tracking)
    ├── colors.js          # Palette de couleurs partagée
    └── style.css          # Styles partagés (responsive)
```

---

## 🛠️ Stack technique

| Composant | Technologie |
|---|---|
| Backend | Node.js 20 + Express 4 |
| Temps réel | Socket.io 4 |
| Base de données | SQLite via sql.js (WASM, zéro compilation) |
| Cartes | Leaflet.js 1.9 + OpenStreetMap |
| Export PDF | jsPDF + jsPDF-AutoTable |
| QR Code | qrcode (npm) |
| Déploiement | Docker + docker-compose |

---

## 📦 Mises à jour via Portainer + Git

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) pour le guide complet Portainer.

En résumé : chaque `git push` sur la branche `main` peut déclencher une mise à jour automatique du container via Portainer (webhook ou auto-update).

---

## 📄 Licence

MIT — voir [LICENSE](LICENSE)

---

## 👤 Auteur

**wdebonne** — [github.com/wdebonne](https://github.com/wdebonne)

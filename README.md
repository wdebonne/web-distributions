# 🗺️ Distribution Tracker

> Application web de suivi GPS en temps réel pour la distribution de courriers en boîtes aux lettres.

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](docs/DEPLOYMENT.md)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

---

## ✨ Fonctionnalités

### 🔐 Authentification & rôles
- Connexion par **email / mot de passe** (JWT 7 jours)
- **Mot de passe oublié** par email (si SMTP configuré)
- Deux rôles : **Admin** et **Créateur**

### 🛡️ Admin
- Gestion des comptes utilisateurs (créer, modifier, désactiver, réinitialiser le mot de passe)
- Vue de **toutes les distributions** avec possibilité de réattribution entre créateurs
- Configuration **SMTP** (hôte, port, SSL, test d'envoi)
- Éditeur de **templates email** (bienvenue, réinitialisation)
- Tableau de bord avec statistiques globales
- **Paramètres du site** : nom, logo, favicon, couleurs, message de connexion *(v2.1)*

### 🗺️ Créateur
- Créer et gérer ses propres distributions
- Génération automatique de **QR code** + lien partageable
- **Délégation** : confier la gestion complète à un autre créateur (congés, maladie)
- **Co-gérants** : ajouter des collaborateurs en lecture/écriture
- Suivi en direct, rapports, clôture

### 👷 Distributeur (mobile, sans compte)
- Rejoindre une distribution via **QR code** ou lien
- Choisir son nom et sa **couleur** sur la carte
- **Suivi GPS en temps réel** du parcours
- **Pause** du suivi (pause repas, fin de journée)
- Voir les routes des autres participants (activable/désactivable)
- Indicateur GPS (précision du signal)
- Reprise de session après fermeture du navigateur

### 🖥️ Suivi & rapports
- Carte **temps réel** avec les tracés colorés par participant (Leaflet.js + OpenStreetMap)
- **Rapport** filtrable : distance, durée, points GPS, statut par utilisateur
- **Export PDF** du rapport avec tableau de statistiques (jsPDF)

### 🎨 Personnalisation *(v2.1)*
- Nom du site, logo emoji, slogan et favicon configurables par l'admin
- Couleur principale de l'interface et dégradé de la page de connexion
- Message d'accueil personnalisé sur la page de connexion
- Branding appliqué dynamiquement sur toutes les pages

---

## 🚀 Démarrage rapide

### Avec Docker (recommandé)

```bash
# 1. Cloner le dépôt
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions

# 2. Créer le répertoire de données persistantes (une seule fois)
mkdir -p /opt/web-distributions/data

# 3. Copier et adapter la configuration
cp .env.example .env
nano .env

# 4. Lancer
docker compose up -d

# 5. Accéder à l'application
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

> **Premier démarrage** — un compte admin est créé automatiquement :
> - Email : valeur de `ADMIN_EMAIL` (défaut : `admin@localhost`)
> - Mot de passe : valeur de `ADMIN_PASSWORD` (défaut : `admin123`)
>
> ⚠️ Changez ces valeurs avant toute mise en production.

---

## ⚙️ Configuration

Copier `.env.example` en `.env` et adapter les valeurs :

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute du serveur |
| `ADMIN_EMAIL` | `admin@localhost` | Email du compte admin créé au 1er démarrage |
| `ADMIN_PASSWORD` | `admin123` | Mot de passe admin — **changer en production !** |
| `JWT_SECRET` | *(valeur par défaut)* | Clé secrète JWT — **changer en production !** |
| `BASE_URL` | *(auto-détecté)* | URL publique complète pour les QR codes |
| `DATA_DIR` | `/data` | Répertoire SQLite dans le container |

La personnalisation du site (nom, couleurs, favicon…) se configure directement depuis l'interface admin → onglet **⚙️ Paramètres**.

---

## 📖 Utilisation

### 1. Se connecter
Aller sur `http://[votre-serveur]/` → page de connexion email + mot de passe.
- **Admin** → redirigé vers le panneau d'administration
- **Créateur** → redirigé vers son tableau de bord

### 2. Personnaliser le site (Admin)
Admin → onglet **⚙️ Paramètres** → configurer nom, logo, couleurs, favicon, message de connexion → **Enregistrer**.

### 3. Créer une distribution (Créateur)
1. Tableau de bord → **+ Créer**
2. Saisir le nom (ex : *Journal du Lundi*)
3. Un **QR code** et un **lien** sont générés automatiquement

### 4. Partager avec les distributeurs
- Afficher le QR code sur un écran ou l'imprimer
- Chaque distributeur scanne le code avec son téléphone (sans compte nécessaire)

### 5. Délégation & co-gestion
- Sur une distribution → bouton **🤝 Partager**
- **Délégué** : gestion complète confiée à un autre créateur
- **Co-gérant** : accès suivi et rapport

### 6. Rapport & export
- Bouton **📊 Rapport** → filtrer les colonnes → **📄 Exporter PDF**

---

## 🗂️ Structure du projet

```
web-distributions/
├── server.js              # Serveur Express + Socket.io + auth JWT
├── database.js            # Couche SQLite (sql.js) — tables + migration
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── CHANGELOG.md
├── docs/
│   ├── API.md             # Documentation API REST + WebSocket
│   ├── DEPLOYMENT.md      # Guide de déploiement complet
│   └── CONTRIBUTING.md    # Guide de contribution
└── public/
    ├── login.html         # Connexion (tous les rôles) — split bureau / carte mobile
    ├── forgot-password.html
    ├── reset-password.html
    ├── change-password.html
    ├── admin.html         # Panneau super-admin (users, distributions, SMTP, templates, paramètres)
    ├── creator.html       # Tableau de bord créateur
    ├── track.html         # Carte de suivi temps réel
    ├── report.html        # Rapports et export PDF
    ├── distribution.html  # Interface distributeur (public, sans compte)
    ├── colors.js          # Palette de couleurs partagée
    └── style.css          # Styles globaux (responsive, variables CSS)
```

---

## 🛠️ Stack technique

| Composant | Technologie |
|---|---|
| Backend | Node.js 20 + Express 4 |
| Temps réel | Socket.io 4 |
| Authentification | JWT (jsonwebtoken) + bcryptjs |
| Base de données | SQLite via sql.js (WASM, zéro compilation native) |
| Emails | Nodemailer |
| Cartes | Leaflet.js 1.9 + OpenStreetMap |
| Export PDF | jsPDF + jsPDF-AutoTable |
| QR Code | qrcode (npm) |
| Déploiement | Docker + docker-compose |

---

## 🔒 Sécurité

- Mots de passe hashés avec **bcryptjs** (10 rounds)
- Sessions **JWT** avec expiration à 7 jours
- Tokens de réinitialisation à usage unique (expiration 1h)
- Routes protégées par rôle (`admin` / `creator`)
- Emails de réinitialisation sans révélation des comptes existants
- **HTTPS recommandé** en production (requis pour le GPS mobile)

---

## 📦 Mises à jour via Portainer + Git

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) pour le guide complet.

Chaque `git push` sur `main` peut déclencher une mise à jour automatique du container via Portainer (webhook ou auto-update). Les données sont persistées dans `/opt/web-distributions/data` sur l'hôte — **aucune perte lors des mises à jour**.

---

## 📄 Licence

MIT — voir [LICENSE](LICENSE)

---

## 👤 Auteur

**wdebonne** — [github.com/wdebonne](https://github.com/wdebonne)

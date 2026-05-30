# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet respecte le [Versionnage Sémantique](https://semver.org/lang/fr/).

---

## [Non publié]

*Les prochaines modifications seront listées ici avant la prochaine release.*

---

## [2.1.0] — 2026-05-30

### ⚙️ Paramètres du site (nouveau)
- Nouvel onglet **Paramètres** dans le panneau admin (`⚙️`)
- **Nom du site** personnalisable (affiché dans les en-têtes et onglets navigateur)
- **Logo emoji** personnalisable avec aperçu en temps réel
- **Slogan** affiché sur la page de connexion (panneau héro)
- **URL du favicon** avec aperçu miniature instantané
- **Texte de pied de page** (version, copyright…)
- **Message d'accueil** optionnel sur la page de connexion
- **Couleur principale** de l'interface avec sélecteur couleur + champ hex synchronisé
- **Dégradé de la page de connexion** : deux couleurs configurables avec aperçu live
- Persistance en base SQLite (`app_settings`) — survivent aux redéploiements
- API publique `GET /api/settings` et admin `GET/PUT /api/admin/settings`

### 🎨 Refonte visuelle complète
- **Page de connexion** redessinée : disposition split bureau (héro + formulaire) / carte mobile
  - Panneau gauche (bureau) : logo, titre, slogan animé et liste des fonctionnalités
  - Panneau droit / carte mobile : formulaire moderne, affichage/masquage du mot de passe
  - Animations de fond (blobs flottants) cohérentes avec le dégradé configuré
- **Pages auth** (`forgot-password`, `reset-password`, `change-password`) redessinées avec la même cohérence visuelle, boutons afficher/masquer mot de passe, messages d'état stylisés
- **Panneau admin** : en-tête amélioré avec badge de rôle, stats cards avec bordure accent et effet hover
- **style.css** modernisé : système de shadows en couches, `border-radius` cohérent (`--radius-sm/lg`), focus ring sur les inputs, transitions fluides, box-shadow sur les boutons au hover

### 🌐 Branding dynamique (toutes les pages)
- Chaque page charge `/api/settings` au démarrage et applique instantanément :
  - `--primary` CSS custom property (+ dark/light dérivés calculés)
  - Favicon via `<link id="dyn-favicon">`
  - `theme-color` meta tag (barre de statut mobile)
  - Nom du site dans les attributs `data-site-name` / `data-site-logo`
  - Titre de l'onglet navigateur
- Pages concernées : `login`, `admin`, `creator`, `track`, `report`, `forgot-password`, `reset-password`, `change-password`

### 🔧 Technique
- Nouvelle table SQLite `app_settings` (clé/valeur) avec migration automatique
- 3 nouveaux endpoints API : `GET /api/settings`, `GET /api/admin/settings`, `PUT /api/admin/settings`
- Utilitaire `_darken` / `_lighten` pour dériver les variantes de couleur en JavaScript pur

---

## [2.0.0] — 2026-05-30

### 🔐 Authentification & rôles (nouveau)
- Système de connexion par **email / mot de passe** avec tokens **JWT** (expiration 7 jours)
- Deux rôles : **Admin** (accès total) et **Créateur** (ses distributions)
- Page de connexion unifiée (`login.html`) avec redirection selon le rôle
- **Mot de passe oublié** par email avec token à usage unique (expiration 1h)
- Changement de mot de passe obligatoire pour les comptes créés par l'admin
- Compte admin créé automatiquement au premier démarrage via variables d'environnement

### 🛡️ Panneau Admin (refonte complète)
- Tableau de bord avec statistiques globales (utilisateurs, distributions, actives)
- **Gestion des utilisateurs** : créer, modifier, désactiver, réinitialiser le mot de passe, supprimer
- Génération automatique de mot de passe avec envoi par email (si SMTP configuré)
- Vue de **toutes les distributions** avec nom du créateur
- **Réattribution** d'une distribution à un autre créateur (ex : arrêt maladie)
- Configuration **SMTP** complète (hôte, port, SSL/TLS, identifiants, expéditeur)
- Bouton **test d'envoi** SMTP avec adresse configurable
- Éditeur de **templates email** en HTML avec variables `{{variable}}`
- Templates par défaut : `reset-password`, `welcome`

### 🗺️ Tableau de bord Créateur (nouveau)
- Interface dédiée `creator.html` avec onglets "Mes distributions" et "Partagées avec moi"
- **Délégation** : confier la gestion complète d'une distribution à un autre créateur
- **Co-gérants** : ajouter plusieurs collaborateurs en accès suivi/rapport
- Révocation de délégation et de co-gestion en un clic
- Badge visuel pour distinguer délégué / co-gérant

### 🗄️ Persistance des données (corrigé)
- `docker-compose.yml` : bind mount direct sur `/opt/web-distributions/data` (hôte)
- Les données survivent désormais à tout redéploiement, rebuild ou mise à jour Portainer

### 🔧 Technique
- Nouvelles dépendances : `bcryptjs`, `jsonwebtoken`, `nodemailer`
- Nouvelles tables SQLite : `app_users`, `dist_managers`, `smtp_settings`, `email_templates`
- Migration automatique des données existantes
- Nouvelles pages : `login.html`, `forgot-password.html`, `reset-password.html`, `change-password.html`
- Variables d'environnement ajoutées : `ADMIN_EMAIL`, `JWT_SECRET`

### ⚠️ Breaking changes
- L'ancienne authentification par `ADMIN_PASSWORD` en header `x-admin-pwd` est remplacée par JWT
- Les URLs `track.html?pwd=X` et `report.html?pwd=X` ne fonctionnent plus — utiliser le login
- Portainer : créer `/opt/web-distributions/data` sur l'hôte avant le premier déploiement

---

## [1.0.0] — 2026-05-30

### 🎉 Première version

#### Ajouté
- **Panneau d'administration** avec authentification par mot de passe
- **Création de distributions** (nom, description) avec génération de QR code et lien partageable
- **Interface utilisateur mobile** pour rejoindre une distribution via QR code ou lien
- **Choix de couleur** pour chaque participant (palette de 16 couleurs)
- **Suivi GPS en temps réel** via l'API Géolocalisation du navigateur
- **Gestion de la pause** : zones non parcourues non marquées
- **Reprise de session** automatique après fermeture du navigateur
- **Carte en temps réel** (Leaflet.js + OpenStreetMap)
- **Indicateur de signal GPS** (précision en mètres)
- **Clôture de distribution** avec notification WebSocket
- **Rapport** avec statistiques par participant (distance, durée, points GPS)
- **Export PDF** du rapport (jsPDF)
- **Design responsive** PC / tablette / mobile
- Base de données SQLite via sql.js (WASM, aucune compilation native)
- Temps réel via Socket.io
- Docker + docker-compose + Portainer + Git ready

---

[Non publié]: https://github.com/wdebonne/web-distributions/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/wdebonne/web-distributions/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/wdebonne/web-distributions/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/wdebonne/web-distributions/releases/tag/v1.0.0

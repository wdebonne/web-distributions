# Guide de contribution — Distribution Tracker

Merci de votre intérêt pour ce projet ! Voici comment contribuer.

---

## 🛠️ Environnement de développement

### Prérequis

- Node.js ≥ 18
- npm ≥ 9
- Git

### Installation

```bash
git clone https://github.com/wdebonne/web-distributions.git
cd web-distributions
npm install
cp .env.example .env
npm start
```

L'application est disponible sur `http://localhost:3000`.  
Mot de passe admin par défaut : `admin123`.

### Structure des fichiers

```
web-distributions/
├── server.js          # Point d'entrée — API REST + Socket.io
├── database.js        # Abstraction SQLite (sql.js)
├── public/            # Fichiers statiques servis par Express
│   ├── admin.html     # SPA admin (login + dashboard)
│   ├── track.html     # Carte temps réel
│   ├── report.html    # Rapports + export PDF
│   ├── distribution.html  # Interface mobile utilisateur
│   ├── colors.js      # Palette partagée (chargée côté client)
│   └── style.css      # Styles globaux responsive
└── docs/              # Documentation
```

---

## 📐 Conventions de code

### JavaScript
- **Pas de framework frontend** — Vanilla JS uniquement (garder la simplicité)
- Pas de transpilation / bundler — le code doit tourner directement dans Node.js et les navigateurs modernes
- `const` par défaut, `let` si réassignation, jamais `var`
- Fonctions nommées plutôt que fléchées pour les handlers principaux
- Nommage : `camelCase` pour les variables/fonctions, `UPPER_SNAKE` pour les constantes globales

### CSS
- Variables CSS dans `:root` pour les couleurs et espacements
- Mobile-first : styles de base pour mobile, `@media (min-width: ...)` pour les écrans plus larges
- Pas de framework CSS — CSS custom uniquement
- Cibles tactiles minimum 44px (WCAG 2.1 AA)

### HTML
- `lang="fr"` sur `<html>`
- `meta viewport` avec `width=device-width, initial-scale=1.0`
- `aria-label` sur les boutons sans texte visible
- `role="dialog"` + `aria-modal="true"` sur les modales

### Backend (server.js / database.js)
- Réponses d'erreur toujours avec `{ error: "message en français" }`
- Codes HTTP sémantiques : 200, 201, 400, 401, 404
- Pas de dépendances inutiles — garder le `package.json` minimal
- `db.init()` est async — toujours attendre avant de démarrer le serveur

---

## 🔄 Processus de contribution

### 1. Forker et cloner

```bash
# Forker sur GitHub, puis :
git clone https://github.com/VOTRE_NOM/web-distributions.git
git remote add upstream https://github.com/wdebonne/web-distributions.git
```

### 2. Créer une branche

Nommage des branches :
- `feat/nom-de-la-fonctionnalite`
- `fix/description-du-bug`
- `docs/mise-a-jour-documentation`
- `refactor/nom-du-composant`

```bash
git checkout -b feat/export-csv
```

### 3. Développer

- Tester manuellement sur **Chrome mobile** (DevTools > toggle device toolbar)
- Tester sur **Firefox** et **Safari/iOS** si possible
- Vérifier que le serveur démarre sans erreur : `npm start`
- Vérifier qu'il n'y a pas d'erreurs dans la console navigateur

### 4. Commit

Format des messages de commit ([Conventional Commits](https://www.conventionalcommits.org/fr/)) :

```
<type>(<scope>): <description courte>

[corps optionnel]

[footer optionnel]
```

Types : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `chore`

Exemples :
```
feat(report): ajouter export CSV en plus du PDF
fix(distribution): corriger la reprise de session après fermeture navigateur
docs(api): documenter l'événement WebSocket user-status
```

### 5. Pull Request

- Titre clair et concis
- Description : contexte, ce qui a changé, comment tester
- Lier l'issue concernée si applicable : `Closes #42`
- Screenshots / vidéo si changement visuel

---

## 🐛 Signaler un bug

Ouvrir une [Issue GitHub](https://github.com/wdebonne/web-distributions/issues) avec :

- **Version** de l'application (voir `package.json`)
- **Navigateur** et version
- **Appareil** (PC / mobile / tablette)
- **Steps to reproduce** : étapes pour reproduire
- **Expected** : comportement attendu
- **Actual** : comportement observé
- **Logs** : console navigateur ou serveur si disponible

---

## 💡 Proposer une fonctionnalité

Ouvrir une Issue avec le label `enhancement` et décrire :
- Le besoin utilisateur
- La solution proposée
- Les alternatives envisagées

---

## 📦 Versionnage

Ce projet suit le [Versionnage Sémantique](https://semver.org/lang/fr/) :
- `MAJOR.MINOR.PATCH`
- `PATCH` : correction de bug rétrocompatible
- `MINOR` : nouvelle fonctionnalité rétrocompatible
- `MAJOR` : changement incompatible

Toujours mettre à jour :
- `package.json` → `version`
- `CHANGELOG.md` → nouvelle entrée de version
- Les badges du `README.md`
- Le commentaire de version dans `server.js`

# Guide de contribution — Distribution Tracker v2.0.0

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
# → http://localhost:3000
# Compte admin créé automatiquement : admin@localhost / admin123
```

---

## 🗂️ Structure des fichiers

```
web-distributions/
├── server.js          # API REST + Socket.io + auth JWT + routes rôles
├── database.js        # SQLite (sql.js) — toutes les tables et fonctions
└── public/
    ├── login.html         # Page de connexion unifiée
    ├── forgot-password.html
    ├── reset-password.html
    ├── change-password.html
    ├── admin.html         # Super-admin : users, distributions, SMTP, templates
    ├── creator.html       # Créateur : distributions, délégation, co-gérants
    ├── track.html         # Carte suivi temps réel (auth JWT requis)
    ├── report.html        # Rapports + export PDF (auth JWT requis)
    ├── distribution.html  # Interface distributeur (public, sans compte)
    ├── colors.js          # Palette de 16 couleurs (partagée côté client)
    └── style.css          # Styles globaux responsive
```

---

## 📐 Conventions de code

### JavaScript
- **Vanilla JS** uniquement — pas de framework frontend, pas de bundler
- Code exécutable directement dans Node.js ≥ 18 et navigateurs modernes
- `const` par défaut, `let` si réassignation, jamais `var`
- Fonctions nommées pour les handlers principaux
- `camelCase` pour variables/fonctions, `UPPER_SNAKE` pour constantes globales

### Auth & sécurité
- Toutes les routes admin/créateur utilisent le middleware `auth(['role'])` de `server.js`
- Jamais de mot de passe en clair dans les logs ou les réponses
- Le champ `smtp_pass` est masqué (`••••••••`) dans les réponses API
- Tokens JWT stockés dans `localStorage` (acceptable pour outil interne)

### CSS
- Variables CSS dans `:root` pour couleurs et espacements
- Mobile-first : styles de base pour mobile, `@media (min-width: ...)` pour écrans plus larges
- Cibles tactiles minimum 44px (WCAG 2.1 AA)
- Pas de framework CSS

### HTML
- `lang="fr"` sur `<html>`
- `meta viewport` avec `width=device-width, initial-scale=1.0`
- `aria-label` sur les boutons sans texte visible
- `role="dialog"` + `aria-modal="true"` sur les modales

### Backend
- Réponses d'erreur : `{ "error": "message en français" }`
- Codes HTTP sémantiques : 200, 400, 401, 403, 404, 500
- `db.init()` est async — toujours attendre avant de démarrer le serveur
- Toute écriture en base déclenche une sauvegarde immédiate via `save()`

---

## 🔄 Processus de contribution

### 1. Forker et cloner

```bash
git clone https://github.com/VOTRE_NOM/web-distributions.git
git remote add upstream https://github.com/wdebonne/web-distributions.git
```

### 2. Créer une branche

| Préfixe | Usage |
|---|---|
| `feat/` | Nouvelle fonctionnalité |
| `fix/` | Correction de bug |
| `docs/` | Documentation uniquement |
| `refactor/` | Refactoring sans changement de comportement |
| `chore/` | Maintenance (deps, config…) |

```bash
git checkout -b feat/export-csv
```

### 3. Développer et tester

```bash
# Tester le serveur
npm start

# Tester l'auth — vérifier :
# - login.html → connexion admin → admin.html
# - login.html → connexion créateur → creator.html
# - distribution.html?id=X → page publique (sans compte)

# Tester le responsive :
# Chrome DevTools → Toggle device toolbar → iPhone 14 Pro
```

Points de vérification avant PR :
- [ ] Serveur démarre sans erreur (`npm start`)
- [ ] Pas d'erreurs dans la console navigateur
- [ ] Testé sur mobile (Chrome DevTools ou vrai appareil)
- [ ] Testé sur Firefox
- [ ] Auth JWT fonctionne (login, refresh, logout)

### 4. Format des commits ([Conventional Commits](https://www.conventionalcommits.org/fr/))

```
<type>(<scope>): <description courte>

[corps optionnel]
```

Exemples :
```
feat(creator): ajouter l'export de distribution en CSV
fix(auth): corriger la redirection après expiration du token JWT
docs(api): documenter les nouveaux endpoints managers
```

### 5. Pull Request

- Titre court et précis
- Description : contexte, changements, instructions de test
- Lier l'issue : `Closes #42`
- Screenshots si changement visuel

---

## 🐛 Signaler un bug

[Ouvrir une Issue GitHub](https://github.com/wdebonne/web-distributions/issues) avec :

- Version (`package.json`)
- Navigateur et version
- Appareil (PC / mobile / tablette)
- Steps to reproduce
- Expected vs Actual
- Logs console (navigateur ou serveur)

---

## 💡 Proposer une fonctionnalité

Issue avec le label `enhancement` :
- Besoin utilisateur
- Solution proposée
- Alternatives envisagées

---

## 📦 Versionnage

[Versionnage Sémantique](https://semver.org/lang/fr/) — `MAJOR.MINOR.PATCH`

À chaque release, mettre à jour :
- [ ] `package.json` → `"version"`
- [ ] `CHANGELOG.md` → nouvelle entrée
- [ ] `README.md` → badge version
- [ ] `docs/API.md` → titre
- [ ] `docs/DEPLOYMENT.md` → titre
- [ ] `docs/CONTRIBUTING.md` → titre
- [ ] `server.js` → commentaire en tête de fichier
- [ ] `database.js` → commentaire en tête de fichier
- [ ] Tag Git : `git tag v2.x.x && git push origin v2.x.x`

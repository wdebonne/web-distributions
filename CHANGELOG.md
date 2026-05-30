# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet respecte le [Versionnage Sémantique](https://semver.org/lang/fr/).

---

## [Non publié]

*Les prochaines modifications seront listées ici avant la prochaine release.*

---

## [1.0.0] — 2026-05-30

### 🎉 Première version

#### Ajouté
- **Panneau d'administration** complet avec authentification par mot de passe
- **Création de distributions** (nom, description) avec génération automatique de QR code et lien partageable
- **Interface utilisateur mobile** pour rejoindre une distribution via QR code ou lien direct
- **Choix de couleur** pour chaque participant (palette de 16 couleurs distinctes, couleurs déjà prises affichées grisées)
- **Suivi GPS en temps réel** des parcours (rues, routes) via l'API Géolocalisation du navigateur
- **Gestion de la pause** : le suivi est interrompu sans marquer les zones non parcourues
- **Reprise de session** automatique après fermeture du navigateur (via localStorage)
- **Carte en temps réel** pour l'admin (Leaflet.js + OpenStreetMap) avec tracés colorés par participant
- **Vue des autres participants** sur la carte utilisateur (activable/désactivable)
- **Indicateur de signal GPS** (précision en mètres, vert/orange)
- **Clôture de distribution** par l'admin avec notification temps réel aux utilisateurs
- **Page de rapport** avec statistiques par participant (distance, durée, points GPS, statut)
- **Filtres d'affichage** du rapport (colonnes sélectionnables)
- **Export PDF** du rapport avec tableau auto-table (jsPDF)
- **Design responsive** : PC, tablette, mobile avec navigation adaptée
  - Admin mobile : navigation liste ↔ détail par glissement
  - Suivi live mobile : carte plein écran + panneau coulissant participants
  - Rapport mobile : onglets Statistiques / Carte
- **Safe area insets** pour les téléphones à encoche (iPhone)
- **Cibles tactiles** conformes WCAG (min. 44px)
- **Base de données SQLite** via sql.js (WASM, aucune compilation native requise)
- **Temps réel** via Socket.io (WebSockets)
- **Docker** + `docker-compose.yml` prêt pour déploiement
- **Compatible Portainer + Git** pour les mises à jour automatiques
- Documentation complète : README, API, Déploiement, Contribution

---

[Non publié]: https://github.com/wdebonne/web-distributions/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/wdebonne/web-distributions/releases/tag/v1.0.0

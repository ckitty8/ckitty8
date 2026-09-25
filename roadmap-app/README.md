# Roadmap PM

Application web **PC-first** pour créer et piloter une roadmap produit/IT, inspirée de la
logique métier d'un fichier Excel de suivi de backlog (colonnes, règles de scoring, workflow
de statuts, simulateur de capacité).

Pensée pour un chef de projet qui travaille sur grand écran : tableau dense, filtres rapides,
Kanban, vue roadmap trimestrielle et tableau de bord, plutôt qu'une interface mobile simplifiée.

## Lancer l'application

Aucune installation, aucun serveur requis : c'est une application 100% statique (HTML/CSS/JS).

- **Le plus simple** : double-cliquer sur `index.html` pour l'ouvrir dans votre navigateur.
- **Recommandé** (évite certaines restrictions de sécurité navigateur) : servir le dossier via
  un petit serveur local, par exemple :
  ```bash
  cd roadmap-app
  python3 -m http.server 8080
  # puis ouvrir http://localhost:8080
  ```

Les données sont stockées dans le navigateur (`localStorage`) : elles persistent d'une session
à l'autre sur le même poste, mais ne sont pas partagées entre plusieurs utilisateurs. Utilisez
Export/Import (CSV ou JSON) pour transmettre ou sauvegarder le backlog.

## Vues disponibles

- **Backlog** : tableau exhaustif de toutes les demandes (colonnes clés, recherche, filtres,
  tri par colonne), avec ajout/édition/suppression via un panneau latéral détaillé.
- **Kanban** : les demandes réparties par statut, dans l'ordre du pipeline de traitement
  (Nouveau → Specs en cours → Prêt pour dév → Dév en cours → Dév terminé → Recette PO →
  Recette DSI → Recette validée → A déployer en PROD → Terminé), avec glisser-déposer entre
  colonnes. Les statuts "En attente" et "Annulée" sont regroupés à part.
- **Roadmap** : les demandes regroupées par trimestre de planification (T1 2026 → T4 2028),
  avec la charge cumulée (JH) par trimestre.
- **Dashboard** : indicateurs clés (nombre de demandes, taux d'avancement, charge totale et
  restante), répartition par statut et par catégorie métier, top priorités.
- **Capacité** : simulateur simple de capacité d'équipe (nombre de développeurs, de PO/chefs
  de projet, TJM, jours ouvrés par trimestre) comparée à la charge planifiée par trimestre —
  pour visualiser rapidement les trimestres en surcharge.

## Logique de priorisation (reprise des formules Excel)

Chaque demande est notée automatiquement :

- **Score** = `(0,5 × Impact client + 0,3 × Impact collaborateur) / (0,2 × Complexité)`
- **Fixe** = 1 si la demande est marquée "Stratégique", sinon 0
- **Clé de tri** = `(1 - Fixe) × 100000 + Priorité demandeur × 1000 + (1000 - Score)`
- **Rang de traitement DSI** = rang croissant sur la Clé, calculé sur les demandes actives
  (hors "Terminé" et "Annulée")

Résultat : les demandes stratégiques passent en premier, puis celles à priorité demandeur la
plus haute, puis celles au meilleur score (impact rapporté à la complexité).

## Champs du backlog

Les champs reprennent la structure de l'onglet "Roadmap fonctionnelle" du fichier source :
identification de la demande (demandeur, parcours, catégorie métier, thématique, US...),
priorisation (état, priorité, impacts, complexité, planification), cadrage & développement
(cadrage AMOA, statut, chiffrage DSI en JH, sprint), recette & mise en production (statuts et
dates de recette / MEP).

## Données de démonstration

Le jeu de données préchargé est **générique et anonymisé** (rôles métier tels que "Direction
Commerciale", "Service Marketing"...) — il illustre la structure et sert de point de départ.
Remplacez-le par vos propres demandes via le bouton **Importer**, ou saisissez-les directement
dans l'application. Le bouton **Réinitialiser** restaure ce jeu de démonstration.

## Structure du projet

```
roadmap-app/
├── index.html   # structure de la page
├── style.css    # thème visuel (dense, orienté grand écran)
├── data.js      # référentiels métier (listes, couleurs, jeu de démonstration)
├── app.js       # logique applicative (état, calculs, rendu, interactions)
└── README.md
```

Aucune dépendance externe : tout fonctionne hors-ligne, y compris sans connexion réseau.

## Documentation technique

- Architecture, menus, modèle de données et règles métier : [`docs/DAT.md`](../docs/DAT.md)
- Maquettes et captures d'écran : [`docs/maquettes/`](../docs/maquettes/)
- Règles de contribution (lisibilité, commentaires, maquette avant code, cohérence, DAT) :
  [`CLAUDE.md`](../CLAUDE.md)
- Vérification des documents après chaque commit : `node scripts/verifier-docs.js`
  (hook automatique : `git config core.hooksPath .githooks`)

# DAT — Document d'Architecture Technique · Roadmap PM

> Document vivant : à mettre à jour à **chaque** évolution (menus, écrans, champs, règles,
> stockage). Voir la règle n°5 dans `CLAUDE.md`. Sa cohérence avec le code est contrôlée
> après chaque commit par `scripts/verifier-docs.js` (règle n°7).

| Version | Date       | Objet |
|---------|------------|-------|
| 0.1     | 2026-09-25 | Création du DAT à partir de l'existant (v1 de l'application) |
| 0.2     | 2026-09-25 | Règle n°7 : script de vérification des documents + hook post-commit (§ 7, § 8) |

---

## 1. Objet de l'application

Application web **PC-first** de pilotage d'une roadmap produit/IT pour un chef de projet :
backlog de demandes, priorisation automatique (formules reprises d'un fichier Excel
« CDO ROADMAP »), suivi du pipeline DSI, vue trimestrielle, tableau de bord et simulateur de
capacité d'équipe.

## 2. Architecture générale

```
┌──────────────────────── Navigateur (poste du chef de projet) ────────────────────────┐
│                                                                                       │
│  index.html ── structure : menu latéral, barre de filtres, 5 vues, tiroir formulaire   │
│      │                                                                                │
│      ├── style.css   thème visuel (dense, grand écran, viewport 1280px)                │
│      ├── data.js     RÉFÉRENTIELS : listes de valeurs, couleurs, libellés, démo        │
│      └── app.js      LOGIQUE : état, calculs métier, rendu des vues, événements        │
│                          │                                                            │
│                          ▼                                                            │
│                   localStorage  (roadmap_pm_items_v1, roadmap_pm_capacity_v1)          │
│                          ▲                                                            │
│                          │  Import / Export fichiers  ◄──►  CSV (;) · JSON             │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

- **Type** : application 100 % statique (HTML/CSS/JS natif), aucune dépendance, aucun serveur,
  fonctionne hors-ligne.
- **Persistance** : `localStorage` du navigateur → données **locales au poste**, non partagées.
- **Échange** : import/export CSV (séparateur `;`, en-têtes = libellés métier) et JSON.
- **Ordre de chargement** : `data.js` puis `app.js` (app.js dépend des constantes globales de data.js).

### 2.1 Découpage de `app.js`

| Section (en-tête dans le code)   | Rôle | Fonctions principales |
|----------------------------------|------|-----------------------|
| State & persistence              | État global unique `state`, lecture/écriture localStorage | `loadData`, `saveData`, `saveCapacity`, `uid` |
| Business logic                   | **Seul endroit** des calculs métier | `computeScore`, `computeFixe`, `computeCle`, `enrichItems`, `getEnrichedItems` |
| Filtering / sorting / search     | Filtres de la barre du haut, recherche, tri | `applyFilters`, `sortItems` |
| Rendering: shell / navigation    | Routeur de vues (affiche la vue active) | `render`, `renderFilterOptions` |
| Vues                             | Une fonction de rendu par menu | `renderBacklog`, `renderKanban`, `renderTimeline`, `renderDashboard`, `renderCapacity` |
| Composants partagés              | Briques HTML réutilisables | `badge`, `cardHtml`, `kpiCard`, `barChart`, `escapeHtml`, `fmtDate` |
| Drawer                           | Formulaire latéral d'ajout / édition | `drawerFormHtml`, `openDrawer`, `saveDrawer`, `deleteItem` |
| Import / Export                  | CSV / JSON | `toCsv`, `parseCsv`, `downloadFile` |
| Bootstrap                        | Branchement des événements, démarrage | `initEvents` |

### 2.2 Cycle de rendu

```
Action utilisateur ─► modifie state (items / filters / view / sort)
                  ─► saveData() si donnée métier modifiée
                  ─► render()
                        └─► getEnrichedItems()  (score, fixe, clé, rang recalculés)
                        └─► render<VueActive>(items)
```
Le rendu est **entièrement reconstruit** à chaque action (simple, suffisant pour quelques
centaines de demandes).

## 3. Menus et écrans

Maquettes / captures de référence : `docs/maquettes/etat-actuel/`.

### 3.1 Menu latéral (navigation)

| Menu        | `data-view` | Section HTML       | Fonction de rendu   | Filtres appliqués | Capture |
|-------------|-------------|--------------------|---------------------|-------------------|---------|
| 📋 Backlog   | `backlog`   | `#view-backlog`    | `renderBacklog`     | Oui (+ tri colonnes) | `01-backlog.png` |
| 🗂️ Kanban    | `kanban`    | `#view-kanban`     | `renderKanban`      | Oui               | `02-kanban.png` |
| 📅 Roadmap   | `timeline`  | `#view-timeline`   | `renderTimeline`    | Oui (hors Annulée) | `03-roadmap.png` |
| 📊 Dashboard | `dashboard` | `#view-dashboard`  | `renderDashboard`   | **Non** (tout le backlog) | `04-dashboard.png` |
| ⚙️ Capacité  | `capacity`  | `#view-capacity`   | `renderCapacity`    | **Non** (tout le backlog) | `05-capacite.png` |

### 3.2 Actions du pied de menu

| Bouton                 | Effet |
|------------------------|-------|
| ⬆ Importer (CSV/JSON)  | **Remplace** tout le backlog par le fichier importé |
| ⬇ Exporter CSV         | Export des demandes enrichies (colonnes = `FIELD_LABELS`) |
| ⬇ Exporter JSON        | Export brut de `state.items` |
| ↺ Réinitialiser        | Recharge le jeu de démonstration + capacité par défaut (après confirmation) |

### 3.3 Barre supérieure (commune à toutes les vues)

Recherche plein texte (demande, demandeur, thématique, parcours, US) · filtres État,
Catégorie, Statut, Planification · bouton **+ Nouvelle demande** (ouvre le tiroir).

### 3.4 Détail des écrans

- **Backlog** : tableau Rang · Catégorie · Demande · Demandeur · État · Statut · Planification ·
  Score · JH · ★ (stratégique) · actions (éditer / supprimer). Tri par clic sur en-tête.
- **Kanban** : une colonne par statut de `STATUT_PIPELINE`, colonnes « hors flux »
  (`STATUT_HORS_FLUX`) à part. Glisser-déposer d'une carte = changement de `statut`.
- **Roadmap** : une colonne par trimestre (`TRIMESTRES`) + « Non planifié », cartes triées par
  rang, total JH par trimestre. Clic carte = édition.
- **Dashboard** : KPI (nb demandes, avancement, charge totale / restante), répartition par
  statut et par catégorie, top priorités.
- **Capacité** : paramètres équipe (nb dev, nb PO, TJM, jours ouvrés/trimestre) et tableau
  capacité dev vs charge planifiée par trimestre, surcharge en rouge.
- **Tiroir « Demande »** (`06-formulaire-demande.png`) : 4 sections — Identification,
  Priorisation (score calculé en lecture seule), Cadrage & Développement, Recette & MEP.

## 4. Modèle de données

### 4.1 Demande (`state.items[]`, clé localStorage `roadmap_pm_items_v1`)

| Champ | Libellé | Type / valeurs | Section formulaire |
|-------|---------|----------------|--------------------|
| `id` | — | chaîne générée (`uid()`) | technique |
| `demandeur`, `parcours`, `us`, `thematique` | cf. `FIELD_LABELS` | texte libre | Identification |
| `categorie` | Catégorie métier | `CATEGORIES` | Identification |
| `moisDemande` | Mois de la demande | date ISO | Identification |
| `demande`, `commentaires` | | texte long | Identification |
| `etat` | Etat | `ETATS` (Ouvert, Fermé, Annulé) | Priorisation |
| `prioriteDemandeur` | Priorité demandeur | 1 Haute · 2 Moyenne · 3 Basse | Priorisation |
| `strategique` | Stratégique | `OUI_NON` | Priorisation |
| `impactClient`, `impactCollaborateur` | | 1–3 | Priorisation |
| `complexite` | Complexité | 1–5 | Priorisation |
| `planification` | Planification | `TRIMESTRES` (T1 2026 → T4 2028) | Priorisation |
| `cadrageAmoa` | Cadrage AMOA | `CADRAGE_STATUTS` | Cadrage & Dév |
| `statut` | Statut | `ALL_STATUTS` (pipeline + hors flux) | Cadrage & Dév |
| `priseEnChargeDSI` | | `OUI_NON` | Cadrage & Dév |
| `chiffrageDSI` | Chiffrage DSI (JH) | nombre (pas 0,5) | Cadrage & Dév |
| `atterrissageChiffrage`, `sprintDSI` | | texte | Cadrage & Dév |
| `avancementDev` | Avancement dév (%) | 0–100 | Cadrage & Dév |
| `estimeMEP`, `dateMEP` | | date ISO | Recette & MEP |
| `statutRecette`, `statutMEP` | | `ITERATIONS` | Recette & MEP |

**Champs calculés** (non stockés, ajoutés par `enrichItems`) : `score`, `fixe`, `cle`, `rang`.

### 4.2 Capacité (`state.capacity`, clé `roadmap_pm_capacity_v1`)

`nbDev` (3) · `nbPO` (1) · `tjmDev` (800) · `tjmPO` (800) · `joursOuvresParTrimestre` (60) —
valeurs par défaut dans `DEFAULT_CAPACITY` (`data.js`).

### 4.3 Référentiels (`data.js`)

`CATEGORIES`, `ETATS`, `OUI_NON`, `CADRAGE_STATUTS`, `STATUT_PIPELINE`, `STATUT_HORS_FLUX`,
`ALL_STATUTS`, `ITERATIONS`, `TRIMESTRES`, `PRIORITE_LABELS`, `STATUT_COLORS`, `ETAT_COLORS`,
`CATEGORIE_COLORS`, `FIELD_LABELS`, `SEED_ITEMS`, `DEFAULT_CAPACITY`.

## 5. Règles métier

| Règle | Formule | Code |
|-------|---------|------|
| Score | `(0,5 × Impact client + 0,3 × Impact collab.) / (0,2 × Complexité)` (0 si complexité vide) | `computeScore` |
| Fixe | 1 si Stratégique = « Oui », sinon 0 | `computeFixe` |
| Clé de tri | `(1 − Fixe) × 100000 + Priorité × 1000 + (1000 − Score)` | `computeCle` |
| Rang DSI | Rang croissant sur la clé, **uniquement** les demandes hors « Terminé » / « Annulée » | `enrichItems` |
| Charge / trimestre | Σ `chiffrageDSI` des demandes non terminées / non annulées, par `planification` | `renderCapacity` |
| Capacité dev | `nbDev × joursOuvresParTrimestre` (JH / trimestre) | `renderCapacity` |

## 6. Points de cohérence (à vérifier avant toute nouvelle fonctionnalité)

Règles de conception à respecter :

1. Toute nouvelle liste de valeurs / couleur / libellé → `data.js`, jamais en dur dans une vue.
2. Tout nouveau calcul métier → section « Business logic » de `app.js`, exposé via
   `enrichItems` si utilisé par plusieurs vues.
3. Tout nouveau champ → `FIELD_LABELS` (sinon absent de l'export/import CSV) + formulaire
   du tiroir + § 4.1 de ce DAT.
4. Toute nouvelle vue → bouton dans `.nav`, `<section id="view-xxx">`, branche dans
   `render()`, ligne dans le § 3.1, maquette PNG.
5. Toute modification de la structure stockée → envisager une nouvelle version de clé
   localStorage (`_v2`) et une migration.

Incohérences connues dans l'existant (à arbitrer, non corrigées) :

| # | Constat | Impact |
|---|---------|--------|
| C1 | Dashboard et Capacité ignorent les filtres de la barre supérieure, les autres vues les appliquent | Chiffres différents selon la vue pour un même filtre |
| C2 | Deux notions proches : `etat` = « Annulé » et `statut` = « Annulée » ; le rang et la charge ne regardent que `statut` | Une demande à l'état « Annulé » mais statut actif reste classée et comptée |
| C3 | Le calcul de charge est fait dans `renderCapacity` (vue) et non dans « Business logic » | Non réutilisable (ex. Roadmap ou Dashboard) |
| C4 | `nbPO` / `tjmPO` sont saisis mais la charge PO n'est pas comparée | Paramètre sans effet visible hors affichage du coût |
| C5 | L'import **remplace** le backlog sans fusion | Risque de perte de données locales |
| C6 | Données locales au navigateur, pas de multi-utilisateur | À traiter si partage d'équipe requis (choix d'architecture ouvert) |

## 7. Arborescence du dépôt

```
ckitty8/
├── CLAUDE.md                      # règles de travail permanentes
├── .githooks/post-commit          # lance la vérification des documents après commit
├── scripts/verifier-docs.js       # contrôle doc ↔ code (règle n°7)
├── docs/
│   ├── DAT.md                     # ce document
│   └── maquettes/
│       └── etat-actuel/           # captures PNG de chaque écran (référence)
└── roadmap-app/
    ├── index.html · style.css · data.js · app.js
    └── README.md                  # guide utilisateur
```

## 8. Outillage qualité documentaire

`scripts/verifier-docs.js` (Node.js, sans dépendance) vérifie après chaque commit :

| Contrôle | Source (code) | Cible (documentation) |
|----------|---------------|------------------------|
| Documents présents | — | `CLAUDE.md`, `docs/DAT.md`, `roadmap-app/README.md` |
| Menus décrits | `data-view` des boutons de `index.html` | § 3.1 |
| Champs décrits | clés de `FIELD_LABELS` (`data.js`) | § 4.1 |
| Fonctions existantes | fonctions `render*` / `compute*` citées | `app.js` |
| Captures existantes | fichiers `.png` cités | `docs/maquettes/etat-actuel/` |
| DAT suivi | code modifié dans le dernier commit | `docs/DAT.md` modifié aussi |

Activation du hook, une fois par poste : `git config core.hooksPath .githooks`.
Le hook **signale** sans annuler le commit ; les écarts sont corrigés au commit suivant.

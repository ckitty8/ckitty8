#!/usr/bin/env node
/* ============================================================
   Vérification des documents (règle n°7 de CLAUDE.md)
   ------------------------------------------------------------
   À lancer après chaque commit (automatique via .githooks/post-commit,
   ou à la main : `node scripts/verifier-docs.js`).

   Contrôle que la documentation reste alignée avec le code :
     1. chaque document attendu existe (CLAUDE.md, DAT, README, captures) ;
     2. chaque menu de index.html est décrit dans le DAT (§ 3.1) ;
     3. chaque champ de FIELD_LABELS (data.js) est décrit dans le DAT (§ 4.1) ;
     4. chaque fonction de rendu render<Vue> citée dans le DAT existe dans app.js ;
     5. chaque capture PNG citée dans le DAT existe sur le disque ;
     6. le DAT a été modifié dans le dernier commit si le code l'a été.

   Aucune dépendance : Node.js seul. Le script n'écrit rien, il signale.
   Code de sortie : 0 = tout est cohérent, 1 = au moins un écart.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

// Liste des écarts trouvés : chaque contrôle y ajoute un message lisible.
const ecarts = [];

/* ---------- 1. Présence des documents attendus ---------- */
const DOCUMENTS = ['CLAUDE.md', 'docs/DAT.md', 'roadmap-app/README.md'];
DOCUMENTS.forEach(doc => {
  if (!exists(doc)) ecarts.push(`Document manquant : ${doc}`);
});
if (ecarts.length) terminer(); // inutile d'aller plus loin sans les documents

const dat = read('docs/DAT.md');
const html = read('roadmap-app/index.html');
const appJs = read('roadmap-app/app.js');
const dataJs = read('roadmap-app/data.js');

/* ---------- 2. Menus : chaque data-view de index.html est dans le DAT ---------- */
const menus = [...html.matchAll(/class="nav-btn[^"]*" data-view="([^"]+)"/g)].map(m => m[1]);
menus.forEach(vue => {
  if (!dat.includes('`' + vue + '`')) ecarts.push(`Menu "${vue}" (index.html) absent du DAT § 3.1`);
});

/* ---------- 3. Champs : chaque clé de FIELD_LABELS est dans le DAT ---------- */
const blocLabels = (dataJs.match(/const FIELD_LABELS = \{([\s\S]*?)\};/) || [])[1] || '';
const champs = [...blocLabels.matchAll(/^\s*(\w+)\s*:/gm)].map(m => m[1]);
champs.forEach(champ => {
  if (!dat.includes('`' + champ + '`')) ecarts.push(`Champ "${champ}" (FIELD_LABELS) absent du DAT § 4.1`);
});

/* ---------- 4. Fonctions citées dans le DAT : elles existent dans app.js ---------- */
const fonctionsCitees = new Set([...dat.matchAll(/`((?:render|compute)\w+)`/g)].map(m => m[1]));
fonctionsCitees.forEach(fn => {
  if (!new RegExp(`function ${fn}\\(`).test(appJs)) ecarts.push(`Fonction "${fn}" citée dans le DAT mais absente de app.js`);
});

/* ---------- 5. Captures PNG citées dans le DAT : elles existent ---------- */
const captures = new Set([...dat.matchAll(/`([\w-]+\.png)`/g)].map(m => m[1]));
captures.forEach(png => {
  if (!exists(`docs/maquettes/etat-actuel/${png}`)) ecarts.push(`Capture "${png}" citée dans le DAT mais absente de docs/maquettes/etat-actuel/`);
});

/* ---------- 6. Dernier commit : code modifié => DAT modifié ---------- */
try {
  const fichiers = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { cwd: ROOT })
    .toString().split('\n').filter(Boolean);
  const codeTouche = fichiers.some(f => /^roadmap-app\/.*\.(js|html|css)$/.test(f));
  const datTouche = fichiers.includes('docs/DAT.md');
  if (codeTouche && !datTouche) ecarts.push('Le dernier commit modifie le code mais pas docs/DAT.md (règle n°5)');
} catch (e) {
  // Hors dépôt git (ou premier commit) : contrôle ignoré, pas bloquant.
}

terminer();

/* Affiche le bilan et sort avec le bon code. */
function terminer() {
  if (ecarts.length === 0) {
    console.log('✔ Documents vérifiés : CLAUDE.md, DAT, README et captures sont cohérents avec le code.');
    process.exit(0);
  }
  console.log(`✘ ${ecarts.length} écart(s) entre la documentation et le code :`);
  ecarts.forEach(e => console.log('  - ' + e));
  process.exit(1);
}

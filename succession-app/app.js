'use strict';

/* ============================================================
   État & persistance
   ============================================================ */
const STORAGE_KEY = 'succession_famille_v1';
const S = window.SuccCalc;

let state;
let currentView = 'dashboard';

const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);

function emptyState() {
  return {
    version: 1, dateSimulation: '',
    defunt: { nom: '', dateNaissance: '', dateDeces: '' },
    conjoint: { present: false, nom: '', dateNaissance: '', regime: 'communaute', ddv: false },
    enfants: [], actifs: [], passifs: [], donations: [], assurancesVie: [], legs: [],
    options: { optionConjoint: '' },
    sim: { beneficiaireId: '', montant: 100000, dispositif: 'classique', nuePropriete: false },
    demarches: {}
  };
}

function normalize(s) {
  const base = emptyState();
  const out = Object.assign(base, s || {});
  ['defunt', 'conjoint', 'options', 'sim'].forEach(k => { out[k] = Object.assign(emptyState()[k], (s || {})[k] || {}); });
  out.enfants.forEach(e => { e.petitsEnfants = e.petitsEnfants || []; });
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = normalize(raw ? JSON.parse(raw) : clone(DEMO_STATE));
  } catch (e) {
    state = normalize(clone(DEMO_STATE));
  }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* stockage indisponible */ }
}

/* ============================================================
   Helpers d'affichage
   ============================================================ */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = v => (Math.round(v || 0)).toLocaleString('fr-FR') + ' €';
const pct = v => (Math.round((v || 0) * 1000) / 10).toLocaleString('fr-FR') + ' %';
const frac = r => ({ 0.5: '1/2', 0.25: '1/4', 0.75: '3/4' }[r] || (Math.abs(r - 2 / 3) < 1e-9 ? '2/3' : Math.abs(r - 1 / 3) < 1e-9 ? '1/3' : pct(r)));
const dateFR = d => d ? d.toLocaleDateString('fr-FR') : '—';

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function input(path, value, opts = {}) {
  const type = opts.type || 'text';
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  const ph = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : '';
  if (type === 'checkbox') return `<input type="checkbox" data-bind="${path}"${value ? ' checked' : ''}>`;
  if (type === 'money') return `<input type="number" min="0" step="100" data-bind="${path}" data-num="1" value="${esc(value)}"${cls || ' class="money"'}${ph}>`;
  return `<input type="${type}" data-bind="${path}" value="${esc(value)}"${cls}${ph}>`;
}
function select(path, value, options, opts = {}) {
  const items = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const empty = opts.empty ? `<option value="">${esc(opts.empty)}</option>` : '';
  return `<select data-bind="${path}">${empty}${items.map(o => `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
}
function personOptions(filter) {
  return S.persons(state).filter(filter || (() => true)).map(p => ({
    value: p.id,
    label: p.kind === 'petit-enfant' ? `${p.nom} (petit-enfant, ${p.parent.nom || '?'})` : p.kind === 'conjoint' ? `${p.nom} (conjoint)` : `${p.nom} (enfant)`
  }));
}
const delBtn = (action, arg) => `<button class="icon-btn" data-action="${action}" data-arg="${esc(arg)}" title="Supprimer">✕</button>`;

/* ============================================================
   Rendu
   ============================================================ */
function render() {
  const ref = S.refDate(state);
  const dd = S.parseDate(state.defunt.dateDeces);
  document.getElementById('dossier-title').textContent = state.defunt.nom ? `Succession de ${state.defunt.nom}` : 'Dossier de succession';
  document.getElementById('dossier-sub').textContent = dd ? `Décès le ${dateFR(dd)}` : 'Simulation anticipée (personne vivante)';
  const refInput = document.getElementById('ref-date');
  refInput.value = dd ? state.defunt.dateDeces : (state.dateSimulation || ref.toISOString().slice(0, 10));
  refInput.disabled = !!dd;
  refInput.title = dd ? 'La date du décès sert de date de référence' : 'Date à laquelle la succession est simulée';

  const res = S.computeSuccession(state);
  renderDashboard(res);
  renderFamille();
  renderPatrimoine(res);
  renderDonations();
  renderSuccession(res);
  renderDemarches();
}

/* ---------- Synthèse ---------- */
function renderDashboard(res) {
  const plan = S.planDonations(state, S.refDate(state));
  const maxNet = Math.max(1, ...res.heirs.map(h => h.brutRecu));
  const bars = res.heirs.filter(h => h.brutRecu > 0).map(h => `
    <div class="bar-row">
      <div class="bar-label"><b>${esc(h.nom)}</b><span class="muted">${esc(h.role)}</span></div>
      <div class="bar-track">
        <div class="bar net" style="width:${(h.net / maxNet) * 100}%"></div>
        <div class="bar tax" style="width:${(h.totalDroits / maxNet) * 100}%"></div>
      </div>
      <div class="bar-value">${eur(h.net)}<span class="muted"> net</span></div>
    </div>`).join('');

  document.getElementById('view-dashboard').innerHTML = `
    <div class="kpis">
      ${kpi('Patrimoine net du défunt', eur(res.actifNet), res.communaute ? 'Biens communs comptés pour moitié' : 'Actif − passif')}
      ${kpi('Bénéficiaires', res.heirs.filter(h => h.brutRecu > 0).length, `${res.nbSouches} souche(s) d'enfants`)}
      ${kpi('Droits estimés', eur(res.totals.droits), res.totals.brut ? `${pct(res.totals.droits / res.totals.brut)} de la transmission` : '')}
      ${kpi('Net transmis', eur(res.totals.net), res.totals.av ? `dont assurance-vie ${eur(res.totals.av)}` : 'Après droits')}
    </div>
    ${warningsBlock(res.warnings)}
    <div class="grid-2">
      <div class="card">
        <h3>Arbre familial</h3>
        ${treeHTML()}
      </div>
      <div class="card">
        <h3>Ce que reçoit chacun</h3>
        <p class="muted small">Option du conjoint : <b>${esc(res.optionLabel)}</b></p>
        <div class="bars">${bars || '<p class="muted">Aucun bénéficiaire : complétez la famille et le patrimoine.</p>'}</div>
        <div class="legend"><span><i class="sw net"></i>Net reçu</span><span><i class="sw tax"></i>Droits</span></div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>Répartition du patrimoine</h3>
        <table class="kv">
          <tr><td>Masse de calcul (actif net + donations)</td><td>${eur(res.masseCalcul)}</td></tr>
          <tr><td>Réserve héréditaire (${frac(res.reserveRate)})</td><td>${eur(res.reserveGlobale)}</td></tr>
          <tr><td>Quotité disponible (${frac(1 - res.reserveRate)})</td><td>${eur(res.qdTotal)}</td></tr>
          <tr><td>Quotité disponible restante après donations hors part</td><td>${eur(res.qdDispo)}</td></tr>
        </table>
        <button class="link-btn" data-goto="succession">Voir le détail de la simulation →</button>
      </div>
      <div class="card">
        <h3>Anticiper par des donations</h3>
        <p>Aujourd'hui, ${esc(state.defunt.nom || 'le donateur')} peut encore transmettre
        <b class="big-inline">${eur(plan.totalFranchise)}</b> sans droits, grâce aux abattements renouvelables tous les 15 ans.</p>
        <button class="link-btn" data-goto="donations">Planifier des donations →</button>
      </div>
    </div>`;
}
const kpi = (label, value, sub) => `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-sub">${esc(sub || '')}</div></div>`;
const warningsBlock = w => w.length ? `<div class="warnings">${w.map(x => `<div>⚠️ ${esc(x)}</div>`).join('')}</div>` : '';

function treeHTML() {
  const d = state.defunt, c = state.conjoint;
  const node = (name, sub, cls) => `<div class="tnode ${cls || ''}"><b>${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  const ref = S.refDate(state);
  const ageTxt = b => { const a = S.ageAt(b, ref); return a != null ? `${a} ans` : ''; };
  const top = `<div class="tcouple">${node(d.nom || 'Défunt', state.defunt.dateDeces ? '✝ ' + dateFR(S.parseDate(d.dateDeces)) : ageTxt(d.dateNaissance), 'root')}
    ${c.present ? '<span class="tlink">⚭</span>' + node(c.nom || 'Conjoint', ageTxt(c.dateNaissance), 'spouse') : ''}</div>`;
  if (!state.enfants.length) return `<div class="tree">${top}<p class="muted">Aucun enfant renseigné.</p></div>`;
  const kids = state.enfants.map(e => `
    <li>
      ${node(e.nom || 'Enfant', e.statut === 'vivant' ? ageTxt(e.dateNaissance) : STATUTS_ENFANT[e.statut], e.statut)}
      ${e.petitsEnfants.length ? `<ul>${e.petitsEnfants.map(p => `<li>${node(p.nom || 'Petit-enfant', ageTxt(p.dateNaissance), 'gc')}</li>`).join('')}</ul>` : ''}
    </li>`).join('');
  return `<div class="tree">${top}<ul class="tkids">${kids}</ul></div>`;
}

/* ---------- Famille ---------- */
function renderFamille() {
  const d = state.defunt, c = state.conjoint;
  const kids = state.enfants.map((e, i) => `
    <div class="card child ${e.statut}">
      <div class="card-head">
        <h3>Enfant ${i + 1}</h3>
        ${delBtn('del-enfant', e.id)}
      </div>
      <div class="form-grid">
        <label>Nom ${input(`enfants.${i}.nom`, e.nom)}</label>
        <label>Date de naissance ${input(`enfants.${i}.dateNaissance`, e.dateNaissance, { type: 'date' })}</label>
        <label>Situation ${select(`enfants.${i}.statut`, e.statut, Object.entries(STATUTS_ENFANT).map(([value, label]) => ({ value, label })))}</label>
        <label class="check">${input(`enfants.${i}.commun`, e.commun !== false, { type: 'checkbox' })} Enfant commun avec le conjoint</label>
        <label class="check">${input(`enfants.${i}.handicap`, e.handicap, { type: 'checkbox' })} En situation de handicap</label>
      </div>
      ${e.statut !== 'vivant' ? `<p class="note">${e.petitsEnfants.length ? '↳ Ses enfants viennent à la succession <b>par représentation</b> et se partagent sa part.' : '↳ Sans descendant, cet enfant ne compte pas parmi les héritiers.'}</p>` : ''}
      <h4>Petits-enfants</h4>
      ${e.petitsEnfants.length ? `<table class="table compact">
        <thead><tr><th>Prénom / nom</th><th>Date de naissance</th><th>Handicap</th><th></th></tr></thead>
        <tbody>${e.petitsEnfants.map((p, j) => `<tr>
          <td>${input(`enfants.${i}.petitsEnfants.${j}.nom`, p.nom)}</td>
          <td>${input(`enfants.${i}.petitsEnfants.${j}.dateNaissance`, p.dateNaissance, { type: 'date' })}</td>
          <td class="center">${input(`enfants.${i}.petitsEnfants.${j}.handicap`, p.handicap, { type: 'checkbox' })}</td>
          <td>${delBtn('del-pe', p.id)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Aucun petit-enfant.</p>'}
      <button class="secondary-btn" data-action="add-pe" data-arg="${e.id}">+ Ajouter un petit-enfant</button>
    </div>`).join('');

  document.getElementById('view-famille').innerHTML = `
    <div class="view-header"><h2>Composition de la famille</h2></div>
    <div class="grid-2">
      <div class="card">
        <h3>Personne dont on prépare la succession</h3>
        <div class="form-grid">
          <label>Nom ${input('defunt.nom', d.nom)}</label>
          <label>Date de naissance ${input('defunt.dateNaissance', d.dateNaissance, { type: 'date' })}</label>
          <label>Date du décès <small class="muted">(laisser vide pour une simulation anticipée)</small> ${input('defunt.dateDeces', d.dateDeces, { type: 'date' })}</label>
        </div>
      </div>
      <div class="card">
        <h3>Conjoint survivant</h3>
        <label class="check">${input('conjoint.present', c.present, { type: 'checkbox' })} Marié(e) au moment du décès</label>
        ${c.present ? `<div class="form-grid">
          <label>Nom ${input('conjoint.nom', c.nom)}</label>
          <label>Date de naissance ${input('conjoint.dateNaissance', c.dateNaissance, { type: 'date' })}</label>
          <label>Régime matrimonial ${select('conjoint.regime', c.regime, [
            { value: 'communaute', label: 'Communauté réduite aux acquêts (par défaut)' },
            { value: 'separation', label: 'Séparation de biens' }])}</label>
          <label class="check">${input('conjoint.ddv', c.ddv, { type: 'checkbox' })} Donation au dernier vivant / testament en faveur du conjoint</label>
        </div>
        <p class="note">Le partenaire de PACS ou le concubin n'est pas héritier légal : il ne peut recevoir que par testament (non géré ici).</p>` : ''}
      </div>
    </div>
    <div class="view-header"><h2>Enfants et petits-enfants</h2>
      <button class="primary-btn" data-action="add-enfant">+ Ajouter un enfant</button></div>
    <div class="grid-2">${kids || '<p class="muted">Aucun enfant. Ajoutez les enfants du défunt (y compris prédécédés, s\'ils ont eux-mêmes des enfants).</p>'}</div>
    <div class="card"><h3>Aperçu de l'arbre</h3>${treeHTML()}</div>`;
}

/* ---------- Patrimoine ---------- */
function renderPatrimoine(res) {
  const natureOpts = [{ value: 'propre', label: 'Propre au défunt' }, { value: 'commun', label: 'Commun (couple)' }];
  const communaute = res.communaute;
  const quote = n => (n === 'commun' && communaute) ? 0.5 : 1;
  const actifs = state.actifs.map((a, i) => `<tr>
    <td>${input(`actifs.${i}.libelle`, a.libelle)}</td>
    <td>${select(`actifs.${i}.type`, a.type, TYPES_ACTIF)}</td>
    <td>${select(`actifs.${i}.nature`, a.nature, natureOpts)}</td>
    <td>${input(`actifs.${i}.valeur`, a.valeur, { type: 'money' })}</td>
    <td class="num">${eur(S.num(a.valeur) * quote(a.nature))}</td>
    <td>${delBtn('del-actif', a.id)}</td></tr>`).join('');
  const passifs = state.passifs.map((p, i) => `<tr>
    <td>${input(`passifs.${i}.libelle`, p.libelle)}</td>
    <td>${select(`passifs.${i}.nature`, p.nature, natureOpts)}</td>
    <td>${input(`passifs.${i}.montant`, p.montant, { type: 'money' })}</td>
    <td class="num">${eur(S.num(p.montant) * quote(p.nature))}</td>
    <td>${delBtn('del-passif', p.id)}</td></tr>`).join('');
  const avs = state.assurancesVie.map((a, i) => `<tr>
    <td>${input(`assurancesVie.${i}.contrat`, a.contrat)}</td>
    <td>${select(`assurancesVie.${i}.beneficiaireId`, a.beneficiaireId, personOptions(), { empty: '— Bénéficiaire —' })}</td>
    <td>${input(`assurancesVie.${i}.capitalAvant70`, a.capitalAvant70, { type: 'money' })}</td>
    <td>${input(`assurancesVie.${i}.primesApres70`, a.primesApres70, { type: 'money' })}</td>
    <td>${delBtn('del-av', a.id)}</td></tr>`).join('');

  document.getElementById('view-patrimoine').innerHTML = `
    <div class="kpis">
      ${kpi('Actif (part du défunt)', eur(res.actifBrut), '')}
      ${kpi('Passif (part du défunt)', eur(res.passif), '')}
      ${kpi('Actif net successoral', eur(res.actifNet), '')}
      ${kpi('Assurance-vie (hors succession)', eur(S.sum(state.assurancesVie.map(a => S.num(a.capitalAvant70) + S.num(a.primesApres70)))), 'Transmise directement aux bénéficiaires')}
    </div>
    ${communaute ? '<p class="note">Régime de communauté : les biens <b>communs</b> appartiennent pour moitié au conjoint survivant ; seule l\'autre moitié entre dans la succession.</p>' : ''}
    <div class="card">
      <div class="card-head"><h3>Actifs</h3><button class="secondary-btn" data-action="add-actif">+ Ajouter un bien</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Bien</th><th>Type</th><th>Propriété</th><th>Valeur totale (€)</th><th class="num">Part successorale</th><th></th></tr></thead>
        <tbody>${actifs || '<tr><td colspan="6" class="muted">Aucun bien.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4">Total</td><td class="num">${eur(res.actifBrut)}</td><td></td></tr></tfoot>
      </table></div>
      <p class="muted small">Astuce : la résidence principale occupée par le conjoint ou un enfant mineur bénéficie fiscalement d'un abattement de 20 % — saisissez la valeur après abattement si vous souhaitez en tenir compte.</p>
    </div>
    <div class="card">
      <div class="card-head"><h3>Dettes et charges</h3><button class="secondary-btn" data-action="add-passif">+ Ajouter une dette</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Libellé</th><th>Nature</th><th>Montant total (€)</th><th class="num">Part successorale</th><th></th></tr></thead>
        <tbody>${passifs || '<tr><td colspan="5" class="muted">Aucune dette.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num">${eur(res.passif)}</td><td></td></tr></tfoot>
      </table></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Assurance-vie</h3><button class="secondary-btn" data-action="add-av">+ Ajouter un bénéficiaire</button></div>
      <p class="muted small">Une ligne par bénéficiaire et par contrat. Capitaux issus de primes versées <b>avant 70 ans</b> : abattement de 152 500 € par bénéficiaire (art. 990 I).
      Primes versées <b>après 70 ans</b> : abattement global de 30 500 €, puis droits de succession classiques (art. 757 B). Le conjoint est exonéré.</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Contrat</th><th>Bénéficiaire</th><th>Capital (primes avant 70 ans)</th><th>Primes versées après 70 ans</th><th></th></tr></thead>
        <tbody>${avs || '<tr><td colspan="5" class="muted">Aucun contrat.</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

/* ---------- Donations ---------- */
function renderDonations() {
  const ref = S.refDate(state);
  const plan = S.planDonations(state, ref);
  const typeOpts = [{ value: 'avance', label: 'Avance de part' }, { value: 'hors_part', label: 'Hors part' }];
  const dispOpts = [{ value: 'classique', label: 'Classique' }, { value: 'don_familial', label: 'Don familial (argent)' }];
  const rows = state.donations.map((d, i) => {
    const recent = S.within15(d.date, ref);
    return `<tr>
      <td>${select(`donations.${i}.beneficiaireId`, d.beneficiaireId, personOptions(), { empty: '— Bénéficiaire —' })}</td>
      <td>${input(`donations.${i}.date`, d.date, { type: 'date' })}</td>
      <td>${input(`donations.${i}.montant`, d.montant, { type: 'money' })}</td>
      <td>${select(`donations.${i}.type`, d.type, typeOpts)}</td>
      <td>${select(`donations.${i}.dispositif`, d.dispositif, dispOpts)}</td>
      <td>${input(`donations.${i}.note`, d.note, { placeholder: 'Objet' })}</td>
      <td><span class="pill ${recent ? 'warn' : 'ok'}">${recent ? '< 15 ans' : '> 15 ans'}</span></td>
      <td>${delBtn('del-donation', d.id)}</td></tr>`;
  }).join('');

  const planRows = plan.rows.map(r => `<tr>
    <td><b>${esc(r.nom)}</b><div class="muted small">${r.kind === 'conjoint' ? 'Conjoint' : r.kind === 'enfant' ? 'Enfant' : 'Petit-enfant'}${r.age != null ? ` · ${r.age} ans` : ''}${r.handicap ? ' · handicap' : ''}</div></td>
    <td class="num">${eur(r.abattement)}</td>
    <td class="num">${eur(r.used)}</td>
    <td class="num"><b>${eur(r.restant)}</b></td>
    <td class="num">${r.familialEligible ? eur(r.familialRestant) : '<span class="muted small">non éligible</span>'}</td>
    <td class="num ok-txt"><b>${eur(r.franchise)}</b></td>
    <td>${r.renouvellement ? dateFR(r.renouvellement) : '<span class="muted">—</span>'}</td></tr>`).join('');

  const sim = state.sim;
  if (!plan.rows.some(r => r.id === sim.beneficiaireId) && plan.rows.length) sim.beneficiaireId = plan.rows[0].id;
  const sr = S.simulateDonation(state, sim, ref);
  const simHTML = sr ? `
    <table class="kv">
      <tr><td>Montant donné</td><td>${eur(sr.montant)}</td></tr>
      ${sim.nuePropriete ? `<tr><td>Valeur taxable de la nue-propriété (donateur de ${sr.donorAge ?? '?'} ans : ${pct(sr.npRate)})</td><td>${eur(sr.valeurTaxable)}</td></tr>` : ''}
      ${sr.exoFamilial ? `<tr><td>Exonération don familial (790 G)</td><td>− ${eur(sr.exoFamilial)}</td></tr>` : ''}
      <tr><td>Abattement personnel utilisé</td><td>− ${eur(sr.abattUtilise)}</td></tr>
      <tr><td>Base taxable</td><td>${eur(sr.baseTaxable)}</td></tr>
      <tr class="total"><td>Droits de donation</td><td>${eur(sr.droits)}</td></tr>
      <tr><td>Taux moyen</td><td>${pct(sr.tauxMoyen)}</td></tr>
    </table>
    ${sim.dispositif === 'don_familial' && !sr.row.familialEligible ? '<p class="warn-txt small">Don familial impossible : le donateur doit avoir moins de 80 ans et le bénéficiaire être majeur.</p>' : ''}
    ${sim.dispositif === 'don_familial' && sim.nuePropriete ? '<p class="warn-txt small">Le don familial ne concerne que les sommes d\'argent en pleine propriété.</p>' : ''}` : '<p class="muted">Ajoutez des membres de la famille.</p>';

  document.getElementById('view-donations').innerHTML = `
    <div class="view-header"><h2>Donations</h2></div>
    <div class="card">
      <div class="card-head"><h3>Donations déjà consenties</h3><button class="secondary-btn" data-action="add-donation">+ Ajouter une donation</button></div>
      <p class="muted small">Les donations <b>en avance de part</b> sont rapportées à la succession pour assurer l'égalité entre enfants.
      Les donations de moins de 15 ans réduisent l'abattement disponible au décès (rappel fiscal), sauf le don familial de somme d'argent.</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Bénéficiaire</th><th>Date</th><th>Montant (€)</th><th>Imputation civile</th><th>Dispositif fiscal</th><th>Objet</th><th>Rappel</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8" class="muted">Aucune donation.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card">
      <h3>Abattements disponibles au ${dateFR(plan.ref)}</h3>
      <p class="muted small">Donateur : ${esc(state.defunt.nom || '—')}${plan.donorAge != null ? `, ${plan.donorAge} ans` : ''}.
      Abattements : 100 000 € par enfant, 31 865 € par petit-enfant, 80 724 € pour le conjoint, + 159 325 € en cas de handicap.
      Don familial de somme d'argent : 31 865 € supplémentaires si le donateur a moins de 80 ans et le bénéficiaire est majeur.</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Bénéficiaire</th><th class="num">Abattement</th><th class="num">Utilisé (15 ans)</th><th class="num">Restant</th><th class="num">Don familial restant</th><th class="num">Total sans droits</th><th>1er renouvellement</th></tr></thead>
        <tbody>${planRows || '<tr><td colspan="7" class="muted">Aucun bénéficiaire.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="5">Potentiel total de transmission sans droits</td><td class="num">${eur(plan.totalFranchise)}</td><td></td></tr></tfoot>
      </table></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <h3>Simuler une nouvelle donation</h3>
        <div class="form-grid">
          <label>Bénéficiaire ${select('sim.beneficiaireId', sim.beneficiaireId, plan.rows.map(r => ({ value: r.id, label: r.nom })))}</label>
          <label>Montant (€) ${input('sim.montant', sim.montant, { type: 'money' })}</label>
          <label>Dispositif ${select('sim.dispositif', sim.dispositif, dispOpts)}</label>
          <label class="check">${input('sim.nuePropriete', sim.nuePropriete, { type: 'checkbox' })} Donation de la nue-propriété (le donateur garde l'usufruit)</label>
        </div>
        <button class="secondary-btn" data-action="sim-to-donation">Enregistrer comme donation réalisée</button>
      </div>
      <div class="card"><h3>Résultat</h3>${simHTML}</div>
    </div>
    <div class="card tips">
      <h3>Bonnes pratiques</h3>
      <ul>
        <li><b>Donner tôt et régulièrement</b> : les abattements se renouvellent tous les 15 ans.</li>
        <li><b>Donner la nue-propriété</b> : seule sa valeur est taxée (ex. 60 % à 65 ans), et l'usufruit rejoint les enfants au décès sans droits.</li>
        <li><b>Donation-partage</b> : fige la valeur des biens au jour de la donation et évite les conflits entre enfants ; elle peut inclure les petits-enfants (donation-partage transgénérationnelle).</li>
        <li><b>Petits-enfants</b> : 31 865 € d'abattement par grand-parent, cumulable avec le don familial de 31 865 €.</li>
      </ul>
    </div>`;
}

/* ---------- Simulation de la succession ---------- */
function renderSuccession(res) {
  const legs = state.legs.map((l, i) => `<tr>
    <td>${select(`legs.${i}.beneficiaireId`, l.beneficiaireId, personOptions(p => p.kind !== 'conjoint'), { empty: '— Légataire —' })}</td>
    <td>${input(`legs.${i}.montant`, l.montant, { type: 'money' })}</td>
    <td>${delBtn('del-legs', l.id)}</td></tr>`).join('');

  const souches = res.souches.map(s => `<tr>
    <td><b>${esc(s.nom)}</b>${s.represente ? '<div class="muted small">représenté(e) par ses enfants</div>' : ''}</td>
    <td class="num">${eur(s.avance)}</td>
    <td class="num">${eur(s.pp)}</td>
    <td class="num">${eur(s.np)}</td>
    <td class="num">${eur(s.part + s.avance)}</td>
    <td class="num">${eur(s.reserveIndiv)}</td></tr>`).join('');

  const heirs = res.heirs.map(h => `<tr>
    <td><b>${esc(h.nom)}</b><div class="muted small">${esc(h.role)}</div></td>
    <td class="num">${h.pp ? eur(h.pp) : '—'}</td>
    <td class="num">${h.np ? eur(h.np) : '—'}</td>
    <td class="num">${h.us ? eur(h.us) : '—'}</td>
    <td class="num">${h.legs ? eur(h.legs) : '—'}</td>
    <td class="num">${(h.avCap990 + h.avPrimes757) ? eur(h.avCap990 + h.avPrimes757) : '—'}</td>
    <td class="num">${eur(h.brutRecu)}</td>
    <td class="num">${h.exonere ? '<span class="pill ok">exonéré</span>' : eur(h.abattement)}</td>
    <td class="num">${h.rappel ? eur(h.rappel) : '—'}</td>
    <td class="num tax-txt">${eur(h.totalDroits)}</td>
    <td class="num"><b>${eur(h.net)}</b></td></tr>`).join('');

  // Comparatif des options du conjoint
  const comparatif = res.options.length > 1 ? res.options.map(o => {
    const st = clone(state); st.options.optionConjoint = o.value;
    const r = S.computeSuccession(st);
    const sp = r.heirs.find(h => h.kind === 'conjoint');
    const enf = S.sum(r.heirs.filter(h => h.kind !== 'conjoint').map(h => h.valeurFiscale));
    return `<tr class="${o.value === res.option ? 'selected' : ''}">
      <td>${esc(o.label)}</td>
      <td class="num">${sp ? eur(sp.valeurFiscale) : '—'}</td>
      <td class="num">${eur(enf)}</td>
      <td class="num tax-txt">${eur(r.totals.droits)}</td>
      <td>${o.value === res.option ? '<span class="pill ok">retenue</span>' : `<button class="link-btn" data-action="choose-option" data-arg="${o.value}">Choisir</button>`}</td></tr>`;
  }).join('') : '';

  document.getElementById('view-succession').innerHTML = `
    <div class="view-header"><h2>Simulation de la succession</h2>
      <span class="muted">au ${dateFR(res.ref)}</span></div>
    ${warningsBlock(res.warnings)}
    <div class="grid-2">
      <div class="card">
        <h3>1. Choix du conjoint survivant</h3>
        ${state.conjoint.present && res.options.length
          ? `<label>Option ${select('options.optionConjoint', res.option, res.options)}</label>
             <p class="muted small">${res.options.some(o => o.value === 'usufruit') ? '' : 'L\'usufruit légal n\'est pas possible car tous les enfants ne sont pas communs au couple. '}
             ${state.conjoint.ddv ? '' : 'Sans donation au dernier vivant, seules les options légales sont ouvertes.'}
             Âge du conjoint : ${res.spouseAge ?? '?'} ans → l'usufruit vaut fiscalement ${pct(res.usRate)} de la pleine propriété.</p>`
          : `<p class="muted">${state.conjoint.present ? 'Le conjoint recueille la totalité en l\'absence de descendants.' : 'Pas de conjoint survivant : les enfants (ou leurs descendants) se partagent la totalité.'}</p>`}
      </div>
      <div class="card">
        <div class="card-head"><h3>2. Legs par testament</h3><button class="secondary-btn" data-action="add-legs">+ Ajouter un legs</button></div>
        <p class="muted small">Ex. léguer une somme à un petit-enfant. Les legs s'imputent sur la quotité disponible (${eur(res.legsMax)} disponibles avec l'option retenue).</p>
        <table class="table compact"><thead><tr><th>Légataire</th><th>Montant (€)</th><th></th></tr></thead>
        <tbody>${legs || '<tr><td colspan="3" class="muted">Aucun legs.</td></tr>'}</tbody></table>
      </div>
    </div>
    <div class="card">
      <h3>3. Masse successorale, réserve et quotité disponible</h3>
      <div class="steps">
        ${step('Actif net', eur(res.actifNet))}<span class="op">+</span>
        ${step('Donations antérieures', eur(res.totalDonations))}<span class="op">=</span>
        ${step('Masse de calcul', eur(res.masseCalcul), 'hl')}
      </div>
      <div class="steps">
        ${step(`Réserve des enfants (${frac(res.reserveRate)})`, eur(res.reserveGlobale))}
        ${step(`Quotité disponible (${frac(1 - res.reserveRate)})`, eur(res.qdTotal))}
        ${step('Dont déjà donnée hors part', eur(res.horsPart))}
        ${step('Legs exécutés', eur(res.legsEff))}
      </div>
      <p class="muted small">Réserve : 1/2 avec un enfant, 2/3 avec deux, 3/4 avec trois ou plus. Un enfant prédécédé ou renonçant compte s'il est représenté par ses propres enfants.</p>
    </div>
    <div class="card">
      <h3>4. Partage entre les branches (souches)</h3>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Branche</th><th class="num">Avance déjà reçue</th><th class="num">Pleine propriété</th><th class="num">Nue-propriété</th><th class="num">Total (avance comprise)</th><th class="num">Réserve individuelle</th></tr></thead>
        <tbody>${souches || '<tr><td colspan="6" class="muted">Aucune branche.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="card">
      <h3>5. Ce que reçoit chaque bénéficiaire et droits à payer</h3>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Bénéficiaire</th><th class="num">Pleine propriété</th><th class="num">Nue-propriété</th><th class="num">Usufruit</th><th class="num">Legs</th><th class="num">Assurance-vie</th><th class="num">Valeur fiscale reçue</th><th class="num">Abattement</th><th class="num">Donations rappelées</th><th class="num">Droits</th><th class="num">Net</th></tr></thead>
        <tbody>${heirs || '<tr><td colspan="11" class="muted">Aucun bénéficiaire.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="6">Total</td><td class="num">${eur(res.totals.brut)}</td><td colspan="2"></td><td class="num">${eur(res.totals.droits)}</td><td class="num">${eur(res.totals.net)}</td></tr></tfoot>
      </table></div>
      <p class="muted small">Montants en nue-propriété et usufruit valorisés selon le barème fiscal (art. 669 CGI). Les petits-enfants venant par représentation se partagent l'abattement de 100 000 € de leur parent ;
      un petit-enfant légataire bénéficie de 1 594 €. Barème en ligne directe de 5 % à 45 %.</p>
    </div>
    ${comparatif ? `<div class="card"><h3>Comparer les options du conjoint</h3>
      <div class="table-wrap"><table class="table">
      <thead><tr><th>Option</th><th class="num">Valeur fiscale conjoint</th><th class="num">Valeur fiscale descendants</th><th class="num">Droits totaux</th><th></th></tr></thead>
      <tbody>${comparatif}</tbody></table></div>
      <p class="muted small">L'usufruit permet au conjoint de garder l'usage des biens (habiter, percevoir les loyers) ; au second décès, les enfants récupèrent la pleine propriété sans droits supplémentaires.</p></div>` : ''}`;
}
const step = (l, v, cls) => `<div class="step ${cls || ''}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`;

/* ---------- Démarches ---------- */
function renderDemarches() {
  const dd = S.parseDate(state.defunt.dateDeces);
  const now = S.today();
  const done = DEMARCHES.filter(d => state.demarches[d.id]).length;
  const cats = [...new Set(DEMARCHES.map(d => d.cat))];
  const html = cats.map(cat => `
    <div class="card"><h3>${esc(cat)}</h3>
      <ul class="checklist">${DEMARCHES.filter(d => d.cat === cat).map(d => {
        const due = dd ? new Date(dd.getTime() + d.delai * 86400000) : null;
        const late = due && !state.demarches[d.id] && due < now;
        return `<li class="${state.demarches[d.id] ? 'done' : ''}">
          <label class="check">${input(`demarches.${d.id}`, !!state.demarches[d.id], { type: 'checkbox' })} ${esc(d.titre)}</label>
          <span class="pill ${late ? 'warn' : ''}">${due ? (late ? 'En retard · ' : 'Avant le ') + dateFR(due) : `J+${d.delai}`}</span>
        </li>`;
      }).join('')}</ul></div>`).join('');
  document.getElementById('view-demarches').innerHTML = `
    <div class="view-header"><h2>Démarches après le décès</h2>
      <span class="muted">${done} / ${DEMARCHES.length} réalisées</span></div>
    <div class="progress"><div style="width:${(done / DEMARCHES.length) * 100}%"></div></div>
    ${dd ? '' : '<p class="note">Renseignez la date du décès (onglet Famille) pour calculer les échéances. En attendant, les délais sont indiqués en jours (J+n).</p>'}
    ${html}`;
}

/* ============================================================
   Interactions
   ============================================================ */
function setPath(path, value) {
  const keys = path.split('.');
  let o = state;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
}

function removePersonRefs(ids) {
  state.donations = state.donations.filter(d => !ids.includes(d.beneficiaireId));
  state.legs = state.legs.filter(l => !ids.includes(l.beneficiaireId));
  state.assurancesVie = state.assurancesVie.filter(a => !ids.includes(a.beneficiaireId));
}

const ACTIONS = {
  'add-enfant': () => state.enfants.push({ id: uid('e'), nom: '', dateNaissance: '', statut: 'vivant', commun: true, handicap: false, petitsEnfants: [] }),
  'del-enfant': id => {
    const e = state.enfants.find(x => x.id === id);
    if (!confirm(`Supprimer ${e.nom || 'cet enfant'} et ses petits-enfants ?`)) return false;
    removePersonRefs([id, ...e.petitsEnfants.map(p => p.id)]);
    state.enfants = state.enfants.filter(x => x.id !== id);
  },
  'add-pe': id => state.enfants.find(x => x.id === id).petitsEnfants.push({ id: uid('p'), nom: '', dateNaissance: '', handicap: false }),
  'del-pe': id => {
    removePersonRefs([id]);
    state.enfants.forEach(e => { e.petitsEnfants = e.petitsEnfants.filter(p => p.id !== id); });
  },
  'add-actif': () => state.actifs.push({ id: uid('a'), libelle: '', type: TYPES_ACTIF[0], valeur: 0, nature: state.conjoint.present ? 'commun' : 'propre' }),
  'del-actif': id => { state.actifs = state.actifs.filter(x => x.id !== id); },
  'add-passif': () => state.passifs.push({ id: uid('l'), libelle: '', montant: 0, nature: 'propre' }),
  'del-passif': id => { state.passifs = state.passifs.filter(x => x.id !== id); },
  'add-av': () => state.assurancesVie.push({ id: uid('v'), contrat: '', beneficiaireId: '', capitalAvant70: 0, primesApres70: 0 }),
  'del-av': id => { state.assurancesVie = state.assurancesVie.filter(x => x.id !== id); },
  'add-donation': () => state.donations.push({ id: uid('g'), beneficiaireId: '', date: new Date().toISOString().slice(0, 10), montant: 0, type: 'avance', dispositif: 'classique', note: '' }),
  'del-donation': id => { state.donations = state.donations.filter(x => x.id !== id); },
  'add-legs': () => state.legs.push({ id: uid('x'), beneficiaireId: '', montant: 0 }),
  'del-legs': id => { state.legs = state.legs.filter(x => x.id !== id); },
  'choose-option': v => { state.options.optionConjoint = v; },
  'sim-to-donation': () => {
    const s = state.sim;
    const p = S.persons(state).find(x => x.id === s.beneficiaireId);
    state.donations.push({
      id: uid('g'), beneficiaireId: s.beneficiaireId, date: S.refDate(state).toISOString().slice(0, 10),
      montant: S.num(s.montant), type: p && p.kind === 'enfant' ? 'avance' : 'hors_part', dispositif: s.dispositif,
      note: s.nuePropriete ? 'Nue-propriété' : ''
    });
    toast('Donation ajoutée à la liste');
  }
};

function bindEvents() {
  document.querySelector('.nav').addEventListener('click', e => {
    const b = e.target.closest('.nav-btn');
    if (b) showView(b.dataset.view);
  });

  document.querySelector('.main').addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'ref-date') { state.dateSimulation = el.value; save(); render(); return; }
    const path = el.dataset.bind;
    if (!path) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.num) v = S.num(v);
    setPath(path, v);
    save();
    render();
  });

  document.querySelector('.main').addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) { showView(g.dataset.goto); return; }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const fn = ACTIONS[b.dataset.action];
    if (fn && fn(b.dataset.arg) !== false) { save(); render(); }
  });

  document.getElementById('btn-print').onclick = () => { showView('succession'); setTimeout(() => window.print(), 50); };
  document.getElementById('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `succession-${(state.defunt.nom || 'dossier').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const fileInput = document.getElementById('import-input');
  document.getElementById('btn-import').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const f = fileInput.files[0];
    if (!f) return;
    f.text().then(txt => {
      try { state = normalize(JSON.parse(txt)); save(); render(); toast('Dossier importé'); }
      catch (err) { alert('Fichier invalide : ' + err.message); }
      fileInput.value = '';
    });
  };
  document.getElementById('btn-empty').onclick = () => {
    if (!confirm('Créer un dossier vide ? Les données actuelles seront remplacées (pensez à les exporter).')) return;
    state = emptyState(); save(); render(); showView('famille');
  };
  document.getElementById('btn-reset').onclick = () => {
    if (!confirm("Recharger l'exemple de démonstration ? Les données actuelles seront remplacées.")) return;
    state = normalize(clone(DEMO_STATE)); save(); render();
  };
}

function showView(v) {
  currentView = v;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  window.scrollTo(0, 0);
}

load();
bindEvents();
render();

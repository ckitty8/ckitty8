/* ============================================================
   Moteur de calcul : succession & donations (droit français)
   Fichier sans dépendance au DOM — testable sous Node.
   ============================================================ */
(function (root) {
  'use strict';

  const C = {
    ABATT_ENFANT: 100000,            // art. 779 I CGI (ligne directe)
    ABATT_PETIT_ENFANT_SUCC: 1594,   // art. 788 IV CGI (à défaut d'autre abattement)
    ABATT_HANDICAP: 159325,          // art. 779 II CGI
    ABATT_DON_PETIT_ENFANT: 31865,   // art. 790 B CGI
    ABATT_DON_EPOUX: 80724,          // art. 790 E CGI
    DON_FAMILIAL: 31865,             // art. 790 G CGI (sommes d'argent)
    DON_FAMILIAL_AGE_MAX: 80,
    AV_990I: 152500,                 // art. 990 I CGI, par bénéficiaire
    AV_990I_SEUIL: 700000,
    AV_757B: 30500,                  // art. 757 B CGI, global
    RAPPEL_ANS: 15                   // art. 784 CGI
  };

  // Barème ligne directe (art. 777 CGI)
  const BAREME_LIGNE_DIRECTE = [
    [8072, 0.05], [12109, 0.10], [15932, 0.15], [552324, 0.20],
    [902838, 0.30], [1805677, 0.40], [Infinity, 0.45]
  ];
  // Barème entre époux / partenaires de PACS (donations)
  const BAREME_EPOUX = [
    [8072, 0.05], [15932, 0.10], [31865, 0.15], [552324, 0.20],
    [902838, 0.30], [1805677, 0.40], [Infinity, 0.45]
  ];

  // Barème fiscal de l'usufruit (art. 669 CGI)
  const BAREME_USUFRUIT = [[21, 0.9], [31, 0.8], [41, 0.7], [51, 0.6], [61, 0.5], [71, 0.4], [81, 0.3], [91, 0.2]];

  const SPOUSE_OPTIONS = {
    quart_pp: '1/4 en pleine propriété (droit légal)',
    usufruit: 'Totalité en usufruit (droit légal)',
    ddv_qd_pp: 'Quotité disponible en pleine propriété (donation au dernier vivant)',
    ddv_mixte: '1/4 en pleine propriété + 3/4 en usufruit (donation au dernier vivant)',
    ddv_usufruit: 'Totalité en usufruit (donation au dernier vivant)'
  };

  /* ---------- utilitaires ---------- */
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : 0; };
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  function bareme(x, table) {
    table = table || BAREME_LIGNE_DIRECTE;
    let tax = 0, prev = 0;
    for (const [lim, rate] of table) {
      if (x <= prev) break;
      tax += (Math.min(x, lim) - prev) * rate;
      prev = lim;
    }
    return tax;
  }

  function usufruitRate(age) {
    if (age == null) return 0.4;
    for (const [a, r] of BAREME_USUFRUIT) if (age < a) return r;
    return 0.1;
  }

  function parseDate(s) {
    if (!s) return null;
    const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? null : d;
  }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function ageAt(birth, ref) {
    const b = parseDate(birth);
    if (!b) return null;
    let a = ref.getFullYear() - b.getFullYear();
    const m = ref.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) a--;
    return a;
  }
  function addYears(d, n) { const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r; }
  function within15(dateStr, ref) {
    const d = parseDate(dateStr);
    if (!d) return true; // date inconnue : prudence, on considère la donation récente
    return d <= ref && addYears(d, C.RAPPEL_ANS) > ref;
  }
  function refDate(state) {
    return parseDate(state.defunt && state.defunt.dateDeces) || parseDate(state.dateSimulation) || today();
  }

  /* ---------- personnes ---------- */
  function persons(state) {
    const list = [];
    if (state.conjoint && state.conjoint.present) {
      list.push({ id: 'conjoint', nom: state.conjoint.nom || 'Conjoint', kind: 'conjoint', dateNaissance: state.conjoint.dateNaissance, handicap: false });
    }
    (state.enfants || []).forEach(e => {
      list.push({ id: e.id, nom: e.nom || 'Enfant', kind: 'enfant', enfant: e, dateNaissance: e.dateNaissance, handicap: !!e.handicap });
      (e.petitsEnfants || []).forEach(p => list.push({
        id: p.id, nom: p.nom || 'Petit-enfant', kind: 'petit-enfant', parent: e, pe: p,
        dateNaissance: p.dateNaissance, handicap: !!p.handicap
      }));
    });
    return list;
  }

  function souchesOf(state) {
    return (state.enfants || [])
      .filter(e => e.statut === 'vivant' || ((e.statut === 'predecede' || e.statut === 'renoncant') && (e.petitsEnfants || []).length > 0))
      .map(e => ({ enfant: e, represente: e.statut !== 'vivant' }));
  }

  function spouseOptions(state) {
    const cj = state.conjoint || {};
    if (!cj.present) return [];
    const souches = souchesOf(state);
    if (!souches.length) return [];
    const allCommon = souches.every(s => s.enfant.commun !== false);
    const keys = [];
    if (cj.ddv) keys.push('ddv_usufruit', 'ddv_mixte', 'ddv_qd_pp');
    keys.push('quart_pp');
    if (allCommon) keys.push('usufruit');
    return keys.map(k => ({ value: k, label: SPOUSE_OPTIONS[k] }));
  }

  /* ============================================================
     Succession
     ============================================================ */
  function computeSuccession(state) {
    const ref = refDate(state);
    const warnings = [];
    const cj = state.conjoint || {};
    const hasSpouse = !!cj.present;
    const communaute = hasSpouse && cj.regime === 'communaute';
    const quote = nature => (nature === 'commun' && communaute) ? 0.5 : 1;

    // 1. Actif net successoral
    const actifs = state.actifs || [];
    const passifs = state.passifs || [];
    const actifBrut = sum(actifs.map(a => num(a.valeur) * quote(a.nature)));
    const passif = sum(passifs.map(p => num(p.montant) * quote(p.nature)));
    const actifNet = Math.max(0, actifBrut - passif);
    if (passif > actifBrut) warnings.push("Le passif dépasse l'actif : les héritiers peuvent accepter à concurrence de l'actif net ou renoncer.");

    // 2. Héritiers réservataires (souches)
    const souches = souchesOf(state);
    const n = souches.length;
    const heirDirectIds = new Set();
    souches.forEach(s => {
      if (s.represente) s.enfant.petitsEnfants.forEach(p => heirDirectIds.add(p.id));
      else heirDirectIds.add(s.enfant.id);
    });

    // 3. Donations antérieures : rapport civil & masse de calcul
    const donations = (state.donations || []).filter(d => { const dd = parseDate(d.date); return !dd || dd <= ref; });
    const isHorsPart = d => d.type === 'hors_part' || !heirDirectIds.has(d.beneficiaireId) &&
      !souches.some(s => s.represente && s.enfant.id === d.beneficiaireId);
    const totalDonations = sum(donations.map(d => num(d.montant)));
    const masseCalcul = actifNet + totalDonations;

    const reserveRate = n === 0 ? (hasSpouse ? 0.25 : 0) : n === 1 ? 1 / 2 : n === 2 ? 2 / 3 : 3 / 4;
    const reserveGlobale = masseCalcul * reserveRate;
    const qdTotal = masseCalcul - reserveGlobale;
    const horsPart = sum(donations.filter(isHorsPart).map(d => num(d.montant)));
    const qdDispo = Math.max(0, qdTotal - horsPart);
    if (horsPart > qdTotal + 0.5) warnings.push('Les donations hors part successorale dépassent la quotité disponible : elles sont réductibles au profit des héritiers réservataires.');

    // 4. Option du conjoint
    const opts = spouseOptions(state);
    let option = 'none';
    if (hasSpouse && n === 0) option = 'tout';
    else if (hasSpouse) {
      option = (state.options && state.options.optionConjoint) || '';
      if (!opts.some(o => o.value === option)) option = opts[0].value;
    }
    if (!hasSpouse && n === 0) warnings.push("Aucun descendant ni conjoint : la dévolution aux autres héritiers (parents, frères et sœurs…) n'est pas gérée par l'application.");
    if (hasSpouse && n === 0) warnings.push("Sans descendant, l'application suppose l'absence de parents du défunt : le conjoint recueille toute la succession.");

    // 5. Legs (testament) — imputés sur la quotité disponible
    let legsMax;
    if (option === 'ddv_qd_pp') legsMax = 0;
    else if (option === 'ddv_mixte') legsMax = Math.max(0, qdDispo - masseCalcul / 4);
    else legsMax = qdDispo;
    legsMax = Math.min(legsMax, actifNet);
    const legs = (state.legs || []).filter(l => num(l.montant) > 0 && l.beneficiaireId);
    const legsDemandes = sum(legs.map(l => num(l.montant)));
    const legsFactor = legsDemandes > legsMax ? (legsDemandes > 0 ? legsMax / legsDemandes : 0) : 1;
    if (legsFactor < 1) {
      warnings.push(option === 'ddv_qd_pp'
        ? "Le conjoint recueille toute la quotité disponible : les legs ne peuvent pas s'exécuter."
        : `Les legs (${fmt(legsDemandes)}) dépassent la quotité disponible restante (${fmt(legsMax)}) : ils sont réduits proportionnellement.`);
    }
    const legsEff = legsDemandes * legsFactor;
    const R = actifNet - legsEff;

    // 6. Part du conjoint
    let spPP = 0, spUS = 0, chPP = 0, chNP = 0;
    switch (option) {
      case 'quart_pp': spPP = R / 4; chPP = R - spPP; break;
      case 'usufruit':
      case 'ddv_usufruit': spUS = R; chNP = R; break;
      case 'ddv_qd_pp': spPP = Math.min(R, qdDispo); chPP = R - spPP; break;
      case 'ddv_mixte': spPP = R / 4; spUS = R - spPP; chNP = spUS; break;
      case 'tout': spPP = R; break;
      default: chPP = R;
    }

    // 7. Partage entre souches avec rapport des avances
    const Cx = chPP + chNP;
    souches.forEach(s => {
      const ids = s.represente ? [s.enfant.id, ...s.enfant.petitsEnfants.map(p => p.id)] : [s.enfant.id];
      s.avance = sum(donations.filter(d => !isHorsPart(d) && ids.includes(d.beneficiaireId)).map(d => num(d.montant)));
      s.part = 0;
    });
    let active = souches.slice();
    for (let i = 0; i <= n && active.length; i++) {
      const masse = Cx + sum(active.map(s => s.avance));
      const ideal = masse / active.length;
      const exces = active.filter(s => s.avance > ideal + 0.005);
      if (!exces.length) { active.forEach(s => { s.part = ideal - s.avance; }); break; }
      exces.forEach(s => {
        s.part = 0;
        warnings.push(`${s.enfant.nom} a déjà reçu en avance de part plus que sa part : rien de plus ne lui revient (une indemnité de réduction est possible si la réserve des autres est atteinte).`);
      });
      active = active.filter(s => !exces.includes(s));
    }
    souches.forEach(s => {
      const f = Cx > 0 ? s.part / Cx : 0;
      s.pp = chPP * f;
      s.np = chNP * f;
    });

    // 8. Bénéficiaires
    const people = persons(state);
    const byId = Object.fromEntries(people.map(p => [p.id, p]));
    const recs = new Map();
    const rec = id => {
      if (!recs.has(id)) {
        const p = byId[id];
        if (!p) return null;
        let role;
        if (p.kind === 'conjoint') role = 'Conjoint survivant';
        else if (p.kind === 'enfant') role = p.enfant.statut === 'vivant' ? 'Enfant' : (p.enfant.statut === 'predecede' ? 'Enfant prédécédé' : 'Enfant renonçant');
        else role = heirDirectIds.has(id) ? 'Petit-enfant (représentation)' : 'Petit-enfant';
        recs.set(id, { id, nom: p.nom, kind: p.kind, role, person: p, pp: 0, np: 0, us: 0, legs: 0, avCap990: 0, avPrimes757: 0 });
      }
      return recs.get(id);
    };
    if (hasSpouse) { const r = rec('conjoint'); r.pp = spPP; r.us = spUS; }
    souches.forEach(s => {
      if (!s.represente) { const r = rec(s.enfant.id); r.pp += s.pp; r.np += s.np; }
      else {
        const k = s.enfant.petitsEnfants.length;
        s.enfant.petitsEnfants.forEach(p => { const r = rec(p.id); r.pp += s.pp / k; r.np += s.np / k; r.soucheSize = k; });
      }
    });
    legs.forEach(l => { const r = rec(l.beneficiaireId); if (r) r.legs += num(l.montant) * legsFactor; });

    // 9. Assurance-vie (hors succession civile)
    const avs = (state.assurancesVie || []).filter(a => a.beneficiaireId);
    avs.forEach(a => { const r = rec(a.beneficiaireId); if (r) { r.avCap990 += num(a.capitalAvant70); r.avPrimes757 += num(a.primesApres70); } });
    const primes757Taxables = sum([...recs.values()].filter(r => r.kind !== 'conjoint').map(r => r.avPrimes757));

    // 10. Fiscalité
    const spouseAge = hasSpouse ? ageAt(cj.dateNaissance, ref) : null;
    const usRate = hasSpouse ? usufruitRate(spouseAge) : 0;
    const heirs = [...recs.values()];
    heirs.forEach(r => {
      const p = r.person;
      r.valeurCivile = r.pp + r.np + r.legs + (r.kind === 'conjoint' ? r.us : 0);
      r.valeurFiscale = r.pp + r.np * (1 - usRate) + r.legs + (r.kind === 'conjoint' ? r.us * usRate : 0);
      r.av757Taxable = 0; r.abattement = 0; r.rappel = 0; r.baseTaxable = 0; r.droits = 0; r.droitsAV = 0;
      if (r.kind === 'conjoint') { r.exonere = true; }
      else {
        if (primes757Taxables > 0) {
          const share = C.AV_757B * r.avPrimes757 / primes757Taxables;
          r.av757Taxable = Math.max(0, r.avPrimes757 - share);
        }
        if (r.kind === 'enfant') r.abattement = C.ABATT_ENFANT;
        else if (heirDirectIds.has(r.id)) r.abattement = C.ABATT_ENFANT / (r.soucheSize || 1);
        else r.abattement = C.ABATT_PETIT_ENFANT_SUCC;
        if (p.handicap) r.abattement += C.ABATT_HANDICAP;
        // Rappel fiscal des donations de moins de 15 ans (hors don familial 790 G)
        if (r.kind === 'enfant' || heirDirectIds.has(r.id)) {
          r.rappel = sum(donations.filter(d => d.beneficiaireId === r.id && d.dispositif !== 'don_familial' && within15(d.date, ref)).map(d => num(d.montant)));
        }
        const base = r.valeurFiscale + r.av757Taxable;
        r.baseTaxable = Math.max(0, base + r.rappel - r.abattement) - Math.max(0, r.rappel - r.abattement);
        r.droits = Math.max(0, bareme(Math.max(0, base + r.rappel - r.abattement)) - bareme(Math.max(0, r.rappel - r.abattement)));
        const t = Math.max(0, r.avCap990 - C.AV_990I);
        r.droitsAV = Math.min(t, C.AV_990I_SEUIL) * 0.20 + Math.max(0, t - C.AV_990I_SEUIL) * 0.3125;
      }
      r.totalDroits = r.droits + r.droitsAV;
      r.brutRecu = r.valeurFiscale + r.avCap990 + r.avPrimes757;
      r.net = r.brutRecu - r.totalDroits;
    });

    const order = { conjoint: 0, enfant: 1, 'petit-enfant': 2 };
    heirs.sort((a, b) => order[a.kind] - order[b.kind]);
    const visible = heirs.filter(r => r.brutRecu > 0.005 || r.kind !== 'enfant' || r.person.enfant.statut === 'vivant');

    return {
      ref, warnings, communaute,
      actifBrut, passif, actifNet, totalDonations, masseCalcul,
      nbSouches: n, reserveRate, reserveGlobale, qdTotal, horsPart, qdDispo,
      option, optionLabel: SPOUSE_OPTIONS[option] || (option === 'tout' ? 'Totalité en pleine propriété' : '—'), options: opts,
      legsDemandes, legsMax, legsEff, spouseAge, usRate,
      souches: souches.map(s => ({ id: s.enfant.id, nom: s.enfant.nom, represente: s.represente, avance: s.avance, part: s.part, pp: s.pp, np: s.np,
        reserveIndiv: n ? reserveGlobale / n : 0 })),
      heirs: visible,
      totals: {
        droits: sum(visible.map(r => r.totalDroits)),
        brut: sum(visible.map(r => r.brutRecu)),
        net: sum(visible.map(r => r.net)),
        av: sum(visible.map(r => r.avCap990 + r.avPrimes757))
      }
    };
  }

  /* ============================================================
     Donations : abattements disponibles & simulateur
     ============================================================ */
  function abattementDonation(p) {
    let a = p.kind === 'enfant' ? C.ABATT_ENFANT : p.kind === 'conjoint' ? C.ABATT_DON_EPOUX : C.ABATT_DON_PETIT_ENFANT;
    if (p.handicap) a += C.ABATT_HANDICAP;
    return a;
  }

  function planDonations(state, refOverride) {
    const ref = refOverride || today();
    const donorAge = ageAt(state.defunt && state.defunt.dateNaissance, ref);
    const donations = (state.donations || []).filter(d => { const dd = parseDate(d.date); return !dd || dd <= ref; });
    const rows = persons(state)
      .filter(p => p.kind === 'conjoint' || p.kind === 'petit-enfant' || p.enfant.statut === 'vivant')
      .map(p => {
        const recent = donations.filter(d => d.beneficiaireId === p.id && within15(d.date, ref));
        const classiques = recent.filter(d => d.dispositif !== 'don_familial');
        const familiaux = recent.filter(d => d.dispositif === 'don_familial');
        const abatt = abattementDonation(p);
        const used = sum(classiques.map(d => num(d.montant)));
        const age = ageAt(p.dateNaissance, ref);
        const familialEligible = p.kind !== 'conjoint' && donorAge != null && donorAge < C.DON_FAMILIAL_AGE_MAX && age != null && age >= 18;
        const familialUsed = sum(familiaux.map(d => num(d.montant)));
        const dates = recent.map(d => parseDate(d.date)).filter(Boolean).sort((a, b) => a - b);
        return {
          id: p.id, nom: p.nom, kind: p.kind, age, handicap: p.handicap,
          abattement: abatt, used, restant: Math.max(0, abatt - used),
          familialEligible, familialUsed, familialRestant: familialEligible ? Math.max(0, C.DON_FAMILIAL - familialUsed) : 0,
          renouvellement: dates.length ? addYears(dates[0], C.RAPPEL_ANS) : null
        };
      });
    rows.forEach(r => { r.franchise = r.restant + r.familialRestant; });
    return { ref, donorAge, rows, totalFranchise: sum(rows.map(r => r.franchise)) };
  }

  function simulateDonation(state, sim, refOverride) {
    const plan = planDonations(state, refOverride);
    const row = plan.rows.find(r => r.id === sim.beneficiaireId);
    if (!row) return null;
    const montant = num(sim.montant);
    const npRate = sim.nuePropriete ? 1 - usufruitRate(plan.donorAge) : 1;
    let valeur = montant * npRate;
    let exoFamilial = 0;
    if (sim.dispositif === 'don_familial' && !sim.nuePropriete) {
      exoFamilial = Math.min(valeur, row.familialRestant);
      valeur -= exoFamilial;
    }
    const table = row.kind === 'conjoint' ? BAREME_EPOUX : BAREME_LIGNE_DIRECTE;
    const avant = Math.max(0, row.used - row.abattement);
    const apres = Math.max(0, row.used + valeur - row.abattement);
    const droits = Math.max(0, bareme(apres, table) - bareme(avant, table));
    const abattUtilise = Math.min(valeur, row.restant);
    return {
      row, montant, npRate, valeurTaxable: montant * npRate, exoFamilial, abattUtilise,
      baseTaxable: apres - avant, droits, net: montant - droits,
      tauxMoyen: montant > 0 ? droits / montant : 0, donorAge: plan.donorAge
    };
  }

  function fmt(v) {
    return Math.round(v).toLocaleString('fr-FR') + ' €';
  }

  const api = {
    C, BAREME_LIGNE_DIRECTE, BAREME_EPOUX, BAREME_USUFRUIT, SPOUSE_OPTIONS,
    num, sum, bareme, usufruitRate, parseDate, ageAt, addYears, within15, refDate, today,
    persons, souchesOf, spouseOptions, computeSuccession, planDonations, simulateDonation, fmt
  };
  root.SuccCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

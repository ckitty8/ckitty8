/* ============================================================
   Référentiels & jeu de démonstration
   ============================================================ */
'use strict';

const TYPES_ACTIF = [
  'Résidence principale', 'Immobilier locatif', 'Résidence secondaire', 'Terrain',
  'Comptes bancaires', 'Livrets', 'Placements financiers', 'Parts de société',
  'Véhicule', 'Mobilier', 'Autre'
];

const STATUTS_ENFANT = {
  vivant: 'Vivant',
  predecede: 'Prédécédé',
  renoncant: 'Renonce à la succession'
};

// Démarches après un décès : délai indicatif en jours depuis la date du décès
const DEMARCHES = [
  { id: 'd1', delai: 1, titre: 'Faire constater le décès et obtenir le certificat médical', cat: 'Immédiat' },
  { id: 'd2', delai: 1, titre: "Déclarer le décès à la mairie (acte de décès) — dans les 24 h", cat: 'Immédiat' },
  { id: 'd3', delai: 6, titre: 'Organiser les obsèques (au plus tard 6 jours ouvrables)', cat: 'Immédiat' },
  { id: 'd4', delai: 7, titre: 'Prévenir les banques (blocage des comptes, frais d’obsèques jusqu’à 5 910 €)', cat: 'Première semaine' },
  { id: 'd5', delai: 7, titre: 'Prévenir l’employeur ou les caisses de retraite', cat: 'Première semaine' },
  { id: 'd6', delai: 30, titre: 'Contacter un notaire (obligatoire si immobilier ou actif > 5 000 €)', cat: 'Premier mois' },
  { id: 'd7', delai: 30, titre: 'Rechercher les contrats d’assurance-vie (AGIRA) et le testament (FCDDV)', cat: 'Premier mois' },
  { id: 'd8', delai: 30, titre: 'Prévenir la CPAM, la CAF, les mutuelles et assureurs', cat: 'Premier mois' },
  { id: 'd9', delai: 60, titre: 'Établir l’acte de notoriété (liste des héritiers)', cat: 'Premiers mois' },
  { id: 'd10', delai: 90, titre: 'Conjoint : exercer son option (usufruit / pleine propriété) — sur sommation, sous 3 mois', cat: 'Premiers mois' },
  { id: 'd11', delai: 120, titre: 'Héritiers : décider d’accepter, accepter à concurrence de l’actif net ou renoncer', cat: 'Premiers mois' },
  { id: 'd12', delai: 180, titre: 'Déposer la déclaration de succession et payer les droits (6 mois)', cat: 'Avant 6 mois' },
  { id: 'd13', delai: 180, titre: 'Déclarer les revenus du défunt (année du décès)', cat: 'Avant 6 mois' },
  { id: 'd14', delai: 365, titre: 'Attestation immobilière : transférer la propriété des biens immobiliers', cat: 'Dans l’année' },
  { id: 'd15', delai: 365, titre: 'Signer l’acte de partage (si les héritiers sortent de l’indivision)', cat: 'Dans l’année' }
];

const DEMO_STATE = {
  version: 1,
  dateSimulation: '',
  defunt: { nom: 'Jean Martin', dateNaissance: '1948-03-12', dateDeces: '' },
  conjoint: { present: true, nom: 'Marie Martin', dateNaissance: '1951-07-04', regime: 'communaute', ddv: true },
  enfants: [
    { id: 'e1', nom: 'Sophie Martin', dateNaissance: '1975-02-20', statut: 'vivant', commun: true, handicap: false,
      petitsEnfants: [
        { id: 'p1', nom: 'Léo', dateNaissance: '2003-05-14', handicap: false },
        { id: 'p2', nom: 'Emma', dateNaissance: '2006-11-02', handicap: false }
      ] },
    { id: 'e2', nom: 'Thomas Martin', dateNaissance: '1978-09-08', statut: 'predecede', commun: true, handicap: false,
      petitsEnfants: [
        { id: 'p3', nom: 'Hugo', dateNaissance: '2008-01-30', handicap: false },
        { id: 'p4', nom: 'Chloé', dateNaissance: '2011-06-17', handicap: false }
      ] },
    { id: 'e3', nom: 'Claire Martin', dateNaissance: '1982-12-01', statut: 'vivant', commun: true, handicap: false,
      petitsEnfants: [
        { id: 'p5', nom: 'Nina', dateNaissance: '2015-04-09', handicap: false }
      ] }
  ],
  actifs: [
    { id: 'a1', libelle: 'Maison familiale (Nantes)', type: 'Résidence principale', valeur: 650000, nature: 'commun' },
    { id: 'a2', libelle: 'Appartement locatif (Lyon)', type: 'Immobilier locatif', valeur: 280000, nature: 'propre' },
    { id: 'a3', libelle: 'Comptes courants et livrets', type: 'Comptes bancaires', valeur: 85000, nature: 'commun' },
    { id: 'a4', libelle: 'PEA', type: 'Placements financiers', valeur: 120000, nature: 'propre' },
    { id: 'a5', libelle: 'Voiture', type: 'Véhicule', valeur: 15000, nature: 'commun' }
  ],
  passifs: [
    { id: 'l1', libelle: 'Prêt immobilier restant dû', montant: 60000, nature: 'commun' },
    { id: 'l2', libelle: 'Frais d’obsèques', montant: 5000, nature: 'propre' }
  ],
  donations: [
    { id: 'g1', beneficiaireId: 'e1', date: '2018-06-01', montant: 50000, type: 'avance', dispositif: 'classique', note: 'Apport achat logement' },
    { id: 'g2', beneficiaireId: 'e3', date: '2021-09-15', montant: 31865, type: 'avance', dispositif: 'don_familial', note: 'Don de somme d’argent' },
    { id: 'g3', beneficiaireId: 'p1', date: '2022-03-10', montant: 20000, type: 'hors_part', dispositif: 'classique', note: 'Études' }
  ],
  assurancesVie: [
    { id: 'v1', contrat: 'Contrat assurance-vie A', beneficiaireId: 'conjoint', capitalAvant70: 200000, primesApres70: 0 },
    { id: 'v2', contrat: 'Contrat assurance-vie B', beneficiaireId: 'p1', capitalAvant70: 80000, primesApres70: 0 },
    { id: 'v3', contrat: 'Contrat assurance-vie B', beneficiaireId: 'p2', capitalAvant70: 80000, primesApres70: 0 },
    { id: 'v4', contrat: 'Contrat assurance-vie C', beneficiaireId: 'p5', capitalAvant70: 0, primesApres70: 40000 }
  ],
  legs: [
    { id: 'x1', beneficiaireId: 'p5', montant: 20000 }
  ],
  options: { optionConjoint: 'ddv_usufruit' },
  sim: { beneficiaireId: 'e3', montant: 100000, dispositif: 'classique', nuePropriete: false },
  demarches: {}
};

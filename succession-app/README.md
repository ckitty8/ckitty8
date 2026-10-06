# Succession Famille

Application web pour **préparer et suivre une succession** au profit des enfants et
petits-enfants, selon le droit civil et fiscal français (barèmes 2026).

> ⚠️ Les résultats sont des **estimations indicatives**. Ils aident à comprendre et à anticiper,
> mais ne remplacent pas l'avis d'un notaire.

## Lancer l'application

Aucune installation : c'est une application 100 % statique (HTML/CSS/JS), qui fonctionne hors ligne.

- Double-cliquer sur `index.html`, ou
- servir le dossier : `cd succession-app && python3 -m http.server 8080` puis ouvrir http://localhost:8080

Les données restent **sur votre ordinateur** (stockage du navigateur). Utilisez **Exporter (JSON)**
pour sauvegarder un dossier ou le transmettre, et **Importer** pour le recharger.
L'interface s'adapte aussi au téléphone et peut être imprimée (ou enregistrée en PDF).

## Onglets

| Onglet | Contenu |
|---|---|
| **Synthèse** | Patrimoine net, droits estimés, net transmis, arbre familial, part de chacun, potentiel de donations sans droits |
| **Famille** | Défunt (ou personne vivante en simulation anticipée), conjoint (régime matrimonial, donation au dernier vivant), enfants (vivant / prédécédé / renonçant, enfant commun, handicap) et leurs enfants |
| **Patrimoine** | Biens et dettes (propres ou communs), contrats d'assurance-vie par bénéficiaire |
| **Donations** | Donations passées (avance de part / hors part, don familial), abattements restants par enfant et petit-enfant, date de renouvellement, simulateur de donation (y compris en nue-propriété) |
| **Simulation** | Option du conjoint, legs par testament, masse de calcul, réserve et quotité disponible, partage par branche avec rapport des donations, droits et net par bénéficiaire, comparatif des options du conjoint |
| **Démarches** | Liste des démarches après décès avec échéances calculées depuis la date du décès |

## Règles appliquées

**Civil**
- Biens communs comptés pour moitié en régime de communauté.
- Réserve héréditaire : 1/2 (1 enfant), 2/3 (2 enfants), 3/4 (3 et plus) ; quotité disponible = le reste.
- **Représentation** : les enfants d'un enfant prédécédé ou renonçant se partagent sa part.
- Conjoint : 1/4 en pleine propriété ou totalité en usufruit (si tous les enfants sont communs) ;
  avec donation au dernier vivant : quotité disponible en pleine propriété, 1/4 PP + 3/4 usufruit, ou totalité en usufruit.
- Donations en avance de part rapportées pour l'égalité entre branches ; legs imputés sur la quotité disponible (et réduits si elle est dépassée).

**Fiscal**
- Barème en ligne directe 5 % → 45 % ; conjoint exonéré.
- Abattements : 100 000 € par enfant (partagés entre petits-enfants venant par représentation),
  1 594 € pour un petit-enfant légataire, + 159 325 € en cas de handicap.
- Rappel des donations de moins de 15 ans (hors don familial de somme d'argent).
- Usufruit / nue-propriété valorisés selon l'âge (art. 669 CGI).
- Assurance-vie : 152 500 € par bénéficiaire puis 20 % / 31,25 % (primes avant 70 ans) ;
  30 500 € global puis droits de succession (primes après 70 ans).
- Donations : 100 000 € par enfant, 31 865 € par petit-enfant, 80 724 € au conjoint, don familial de 31 865 €
  (donateur de moins de 80 ans, bénéficiaire majeur).

**Simplifications** : pas de réévaluation des biens donnés au jour du décès, pas de gestion des
parents/frères et sœurs du défunt, du PACS, des réductions de droits pour charges de famille,
ni du rappel fiscal pour les petits-enfants simples légataires.

## Structure

```
succession-app/
├── index.html   # structure de la page
├── style.css    # thème (responsive + impression)
├── calc.js      # moteur de calcul juridique et fiscal (sans DOM, testable sous Node)
├── data.js      # référentiels, démarches, dossier de démonstration
├── app.js       # état, rendu des onglets, interactions
└── README.md
```

Le dossier de démonstration (famille Martin, fictive) se recharge avec **Exemple de démonstration** ;
**Nouveau dossier vide** permet de saisir sa propre famille.

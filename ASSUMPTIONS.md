# ASSUMPTIONS — décisions prises sans consigne explicite

Document vivant (SPEC §0). Chaque leaf ajoute ses propres entrées ; ce fichier
n'est jamais réordonné, seulement complété. Revu et finalisé par la leaf F3.

## Décisions de planification (driver, avant dispatch)

- **Pas de routeur d'URL.** SPEC exige une navigation qui ne dépend jamais de la
  lecture ; un routeur basé sur l'URL n'apporte rien (pas de deep-linking utile
  pour un enfant de 5 ans) et ajoute une dépendance. Navigation par machine à
  états d'écrans dans `src/app/`.
- **B1 (curriculum) reste une vraie leaf dispatchée**, pas pré-écrite par le
  driver dans le contrat, pour respecter « ne pas ré-inventer la décomposition »
  de SPEC §0 qui liste B1 comme leaf à part entière — même si le contenu exact
  (tableau §5) est déjà entièrement spécifié et la tâche est donc classée
  `mechanical`.
- **Contrat de props `ChallengeComponentProps`** (challenge, helpLevel, onAnswer,
  speak) découple délibérément les branches C (mécaniques) et D (moteur de
  progression) : D ne connaît aucune mécanique de défi, C ne connaît aucune
  règle de maîtrise/aide. Permet le dispatch parallèle de C et D dès la
  vague 1-2 sans dépendance croisée.
- **Découpage en profondeur 4 limité à B2 (corpus).** L'arbre imposé par SPEC §0
  ne détaille explicitement que A1-A4 et B1-B4 ; C, D, E, F sont redécoupés par
  le driver en 4 leaves chacune sur le même principe de granularité. Seul B2 est
  scindé en 4 sous-leaves (B2.1-B2.4) car c'est le seul endroit où le volume de
  contenu (200+ mots, phrases, textes) cache de vrais livrables indépendants et
  parallélisables ; ailleurs, une décomposition plus fine créerait des leaves de
  remplissage (voir references/method.md du skill unlazy : « If the requested
  depth would create filler leaves, state the mismatch »).
- **GB6 (aucun contenu en dur) est le filet de sécurité final, pas dupliqué par
  leaf.** Chaque leaf de contenu tactile (C2-C4, E) documente la contrainte en
  gate manuel ; la preuve exécutable unique et faisant autorité reste GB6 de
  leaf-B4, re-exécutée à l'intégration de branche B et à l'audit racine.
- **Aucun mot-outil interdit avant le niveau 8.** Les mots-outils de SPEC §5
  (le, la, les, un, une, des, est, et, dans, sur, avec, il, elle, je, tu, a, ont,
  qui) ne sont exemptés de la contrainte de décodabilité qu'à partir du niveau 8
  et seulement quand `isSightWord: true` est déclaré explicitement dans le
  contenu (jamais par déduction implicite).

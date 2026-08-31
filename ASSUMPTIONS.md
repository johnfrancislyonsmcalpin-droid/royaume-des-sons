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

## Piège d'outillage découvert pendant le dispatch de la vague 1

- **`tsc --noEmit` seul à la racine ne vérifie RIEN et réussit toujours.**
  `tsconfig.json` est un config "solution" (`files: []` + `references` vers
  `tsconfig.app.json`/`tsconfig.node.json`), donc `tsc --noEmit` sans `-b` ne
  résout aucun fichier : exit 0 systématique, y compris avec des erreurs de
  type réelles dans le code. Chaque leaf de la vague 1 a lancé cette commande
  en auto-vérification et a rapporté "0 erreur" à tort. Le driver ne l'a
  découvert qu'en réconciliant un avertissement de la leaf A1 (qui avait
  elle-même contourné le piège avec `tsc --noEmit -p tsconfig.app.json`) avec
  une reverification manuelle : `npx tsc -b` a immédiatement révélé une
  vraie erreur de type dans `src/voice/watchdog.test.ts` (leaf A2), invisible
  jusque-là. Corrigé : `npm run typecheck` = `tsc -b` (package.json), et tous
  les gates `N4` de `.unlazy/royaume/gates/node-*.md` + `RG2` de `GATES.md`
  utilisent désormais `tsc -b`. Toute leaf/agent futur doit utiliser
  `npx tsc -b` (jamais `tsc --noEmit` seul) pour l'auto-vérification.

## Décisions de contenu (B3 — table de confusion et de prononciation)

- **`z` et `j` comme identifiants symboliques dans `confusion.json` uniquement.**
  Le curriculum (B1) n'a pas de graphème `z` ou `j` isolé : le son /z/ vient de
  la règle « s entre voyelles » (niveau 7) et le son /ʒ/ de `g-doux`. Pour
  rester fidèle aux paires phonétiques explicitement listées en SPEC §7 (s/z,
  ch/j), `confusion.json` déclare quand même `"s": ["z", ...]` et
  `"ch": ["j", ...]` avec des ids symboliques qui ne correspondent à aucun
  `ContentItem.graphemeIds` réel du corpus. Vérifié sans risque : la sélection
  de distracteurs de D2 (`src/engine/distractors.ts`) retombe proprement sur
  son repli (items déjà rencontrés du même niveau) quand la recherche par
  graphème confusable ne trouve aucun item, donc `z`/`j` ne produisent jamais
  de crash ni de distracteur invalide, seulement un repli silencieux.
- **`p/q` modélisé comme `p ↔ qu`** : le curriculum n'enseigne pas de graphème
  `q` isolé (il n'existe que dans le digramme `qu`, niveau 7), qui est le seul
  porteur de la forme visuelle de la lettre q.
- **Schwas muets généralisés à toutes les occlusives** (p→"peu", t→"teu",
  b→"beu", d→"deu", c-dur/k/qu→"keu", g-dur→"gueu") pour éviter que le moteur
  vocal ne lise le son comme le nom de la lettre. SPEC ne prescrit
  explicitement que p→"peu" ; les autres suivent le même principe linguistique
  par jugement de B3, à valider à l'oreille avec la vraie voix Android.

## Décisions de découplage (E1 — carte du monde)

- **Bouton tactile local** (`TapButton.tsx`, même précédent que `E2/TouchButton.tsx`) en attendant `TapTarget` (C1, en cours en parallèle) ; signature de `WorldMap` conçue pour ne pas changer au branchement.
- **Callback `onAnnounce?: (text) => void`** plutôt qu'un import direct de `src/narration/**`, pour rester découplé pendant le dispatch parallèle.
- **État "completed" d'une région dérivé de `progress.currentLevel`** (`level < currentLevel`), pas de nouveau champ dans `ProgressState` (contrat figé). Limite connue : en mode aventure libre après le niveau 10, la région 10 reste affichée "current", jamais "completed" — à revoir si le mode aventure libre (SPEC §5 niveau 10) l'exige.

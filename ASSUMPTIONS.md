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

## Décision de modélisation (B2.3 — phrases niveau 8 + mini-textes niveau 9)

- **Mots-outils jamais marqués `isSightWord` sur un item `sentence`/`text`.**
  `ContentItem.graphemeIds`/`isSightWord` s'appliquent à l'item entier ; pour
  une phrase, `graphemeIds` = union des décompositions des seuls mots
  décodables qu'elle contient, les mots-outils (le, la, les, un, une, des,
  est, et, dans, sur, avec, il, elle, je, tu, a, ont, qui) n'y entrant jamais
  puisqu'ils sont reconnus globalement, pas décodés.
- **Une "phrase" d'un mini-texte est une ligne séparée par `\n`**, pas un
  découpage par ponctuation (une ligne de dialogue avec `!` interne fausserait
  un comptage par ponctuation).
- **`graphemesKnownAtLevel(8)` et `(9)` sont strictement égales à `(7)`** :
  B1 n'introduit aucun nouveau graphème aux niveaux 8-9, tout le vocabulaire
  décodable des phrases/textes vient des 35 graphèmes des niveaux 1-7.

## Décision de modélisation (B2.2 — mots niveaux 6-7 + pseudo-mots)

- **`e-muet` réutilisé pour tout "e" nu non accentué (final ou médian, schwa)**,
  faute de graphème dédié dans le curriculum B1 pour le schwa médian. Les
  graphèmes isolés j, h, x, y, w, z et q ne sont enseignés nulle part dans le
  curriculum : aucun mot n'en contient. `graphemeIds` reste une décomposition
  pédagogique explicite (SPEC §5), pas un miroir lettre à lettre de
  l'orthographe — l'accentuation dans `text` (â, î, ô, ç) est libre tant que
  `graphemeIds` ne référence que des ids connus.
- Quelques mots d'exemple de SPEC écartés faute d'emoji non ambigu ou de
  décomposition propre (grand, petit, pigeon, moulin→remplacé par mouton) :
  qualité du corpus préférée au respect littéral de la liste d'exemples.

## Décisions (F2 — PWA/service worker + écran de vérification voix)

- **VoiceCheckScreen s'affiche avant l'écran « Jouer », une seule fois**
  (drapeau localStorage dédié `royaume-des-sons:voice-check-done`, distinct de
  la clé de sauvegarde d'A3). Il amorce sa propre voix sur son propre geste
  (bouton « Écouter un exemple ») plutôt que de dépendre du bouton Jouer de A1,
  pour rester intégrable sans ordre imposé. `shouldShowVoiceCheck()` exposé
  pour que l'intégration (node-A) décide de l'écran initial réel.
- **Texte écrit accepté dans VoiceCheckScreen** (marche à suivre Android,
  boutons « j'entends »/« je n'entends pas ») : SPEC désigne explicitement cet
  écran comme le seul du jeu qui s'adresse à un lecteur adulte, donc hors du
  périmètre « contenu pédagogique enfant » de CLAUDE.md règle 2 (JSON dans
  src/content/). Confirmé par le driver à la revue de cette leaf.
- **État muet (A2) traité comme déclencheur complémentaire, pas seul juge** :
  `getMuteState()` signifie « deux échecs de démarrage de la voix », pas
  littéralement « aucune voix fr-* » (un navigateur avec une voix par défaut
  non française démarrerait sans jamais muter). La confirmation manuelle
  adulte reste le détecteur principal ; un bouton « réessayer » recharge la
  page plutôt que de changer d'état local, car la sélection de voix d'A2 n'est
  résolue qu'une fois par instance du moteur.
- **public/sw.js est un script classique** (pas de module ES) : un service
  worker avec `export` nécessiterait `{type:'module'}` à l'enregistrement et
  `tsc -b` refuse de typer un module hors `src/` — repassé en script simple,
  testé via import `?raw` exécuté dans un contexte global simulé.

## Décision (B2.1 — syllabes + mots niveaux 3-5) et incident de dispatch

- **Tout `e` plein non final/non accentué mappé sur le graphème `e-muet`**
  (ex. "totem" → t,o,t,e-muet,m), faute d'un graphème schwa médian dédié dans
  le curriculum B1 — même convention que celle adoptée indépendamment par
  B2.2. "totem" déplacé du niveau 3 (exemple SPEC) au niveau 5, car `e-muet`
  n'est enseigné qu'au niveau 4.
- **Incident** : la première tentative de cette leaf a échoué (dépassement de
  la limite de tokens de sortie de l'agent en écrivant tout `words-l3-5.json`
  en une seule réponse). Le bail a été libéré manuellement par le driver après
  confirmation du statut "failed" du processus (jamais en aveugle), puis
  re-réclamé pour une deuxième tentative qui a réutilisé les fichiers déjà
  corrects (`syllables.json`, les deux fichiers de test) et n'a eu qu'à écrire
  le JSON manquant, en plusieurs petits appels d'outils plutôt qu'un seul —
  a réussi du premier coup. Aucune leçon de contenu à en tirer, seulement une
  leçon opérationnelle : demander explicitement l'écriture incrémentale pour
  toute leaf produisant un gros fichier de données.

## Incident de dispatch (E4) — commande git globale pendant un dispatch parallèle

L'agent de la leaf E4 a exécuté `git stash --keep-index -u` pour isoler une
erreur `tsc -b`, alors que 4 autres leaves (B4, C2, C3, et déjà-rendues B2.4,
C4) écrivaient ou avaient déjà écrit des fichiers non suivis en parallèle.
`git stash -u` capture TOUS les fichiers non suivis du dépôt, pas seulement
ceux de la leaf appelante — un risque réel de collision si une leaf sœur avait
écrit un fichier entre le stash et le pop. L'agent a repopé immédiatement et
vérifié `git status` + la suite de tests complète après coup ; aucune perte
constatée cette fois, mais c'est de la chance de timing, pas une garantie.
Corrigé : le contrat (PLAN.md, section Conventions) interdit désormais
explicitement toute commande git affectant l'arbre entier dans un prompt de
leaf dispatchée en parallèle.

## Point de réconciliation ouvert (C2 vs C4) — phrases du compagnon en dur

C2 (listenTouch/readShow/trueFalseWord/companionQuestion) code en dur 8 courtes
phrases d'encouragement du compagnon (ex. "Bravo, tu as trouvé !") passées à
`ChallengeFeedback`, par analogie avec les libellés/narrations déjà en dur dans
E1/E2/E4 (aria-labels, textes de région/récompense — jamais lus/décodés par
l'enfant, seulement énoncés ou destinés à un lecteur d'écran adulte). C4 a fait
le choix inverse : ne rend PAS `ChallengeFeedback` du tout, jugeant qu'une
phrase compagnon codée en dur violerait CLAUDE.md règle #2 à la lettre.
**TRANCHÉ.** GB6 (leaf B4, exécuté réellement) a trouvé 29 occurrences de
texte français en dur : les 8 phrases de compagnon de C2, ET les libellés de
narration d'E1 (`regionNarration.ts`) et E4 (`grandLivreNarration.ts`) déjà
committés — le précédent WorldMap/GrandLivre n'était donc PAS une exemption
valide, seulement un angle mort de GB6 avant que la vraie heuristique existe.
Correction appliquée par le driver : toutes ces phrases sont extraites vers
`src/content/uiText.json` (nouveau, texte d'interface/narration — distinct du
corpus pédagogique décodable, mais soumis comme lui à la règle #2 « aucune
phrase en dur dans le code ») + un loader `src/content/uiText.ts` avec
interpolation `{cle}`. `regionNarration.ts`, `grandLivreNarration.ts` et les 4
composants de C2 mis à jour pour l'importer. `node tools/check.mjs code
--no-hardcoded-content` confirme `0 occurrence` après correction. **C3/C4
avaient la bonne intuition** (ne pas coder de phrase compagnon en dur) mais
n'avaient pas la solution complète (ils s'abstiennent simplement de rendre
`ChallengeFeedback`) — non modifiés, cette abstention reste valide, mais une
leaf future (E3, quête) pourra leur passer une phrase sourcée de
`uiText.json` via `ChallengeComponentProps` si souhaité. Aussi corrigé au même
moment : 10 emoji dupliqués dans le corpus (GB3), voir plus bas.

## Correction (B4/GB3) — 10 emoji dupliqués dans le corpus

GB3 a trouvé 10 paires de mots partageant le même emoji (ex. ara/perroquet
🦜, pull/chemise 👕, mimosa/fleur 🌼) : dans chaque cas, le mot introduit au
niveau le plus bas (3, 4 ou 5) a reçu un nouvel emoji distinct et non ambigu,
le mot du niveau supérieur (6 ou 7) gardant l'original. `ara` et `tiara`
n'ayant pas d'emoji distinctif exact disponible dans le jeu de caractères
Unicode courant (synonymes proches de perroquet/couronne), un emoji
visuellement distinct et raisonnablement associable a été choisi (🦩 pour
ara, 🎀 pour tiara) plutôt que de remplacer ces mots par d'autres — cas
similaire pour `canif` (✂️, plutôt que le 🔪 déjà pris par couteau). Les 9
autres candidats (`totem`→🏛️, `fort`→🏰, `lot`→🏆, `sport`→🏅, `mimosa`→🌻,
`tilapia`→🐠, `pull`→🥼) sont des associations directes plus précises que
l'original (ex. `fort`→🏰 représente en fait mieux le mot que 💪, qui
convenait davantage à `bras`). `node tools/check.mjs content --emoji` confirme
`0 missing, 0 duplicate` après correction.

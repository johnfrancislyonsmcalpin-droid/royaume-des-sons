# Contenu pédagogique — guide de contribution

Ce document explique comment ajouter ou modifier du contenu pédagogique
(graphèmes, syllabes, mots, pseudo-mots, phrases, textes) et comment relancer
les vérifications qui protègent la contrainte de décodabilité. Pour la
pédagogie et les volumes exigés, voir [`SPEC.md`](./SPEC.md) §5. Pour les
règles non négociables (dont **règle #2 : aucun mot, syllabe ou phrase en dur
dans le code**), voir [`CLAUDE.md`](./CLAUDE.md).

## Où vit le contenu

```
src/content/
  curriculum.json      # 10 niveaux, compétences, graphèmes (source de vérité pédagogique)
  curriculum.ts         # loader/validateur + graphemesKnownAtLevel()
  pronunciation.json    # graphème -> texte à énoncer (jamais une lettre brute)
  confusion.json         # table de confusion pour les distracteurs (SPEC §7)
  uiText.json / uiText.ts   # phrases d'INTERFACE (compagnon, carte, Grand Livre) —
                              # jamais lues/décodées par l'enfant, distinctes du corpus
  questionPrompts.json / .ts # promptKey -> question française (La question du compagnon)
  corpus/
    syllables.json          # syllabes CV, niveau 3
    words-l3-5.json          # mots, niveaux 3 à 5
    words-l6-7.json           # mots, niveaux 6 à 7
    pseudowords.json           # pseudo-mots, niveau 7 (vrai mot / faux mot)
    sentences-l8.json           # phrases, niveau 8
    texts-l9.json                 # mini-textes, niveau 9 (3-5 phrases + questions)
    texts-l10.json                 # textes du boss final, niveau 10 (5-6 phrases + 2 questions)
  corpus.ts               # assemble et valide tous les fichiers corpus/*.json en ContentItem[]
```

Le contrat TypeScript qui régit ces fichiers est figé dans
[`src/types.ts`](./src/types.ts) et ne doit pas être dupliqué ni contourné :

- `Curriculum` / `CurriculumLevel` / `Skill` / `Grapheme` — le modèle des 10
  niveaux (`curriculum.json`).
- `ContentItem` — un item de corpus (graphème, syllabe, mot, pseudo-mot,
  phrase ou texte) :

  ```ts
  interface ContentItem {
    id: string
    kind: 'grapheme' | 'syllable' | 'word' | 'pseudoword' | 'sentence' | 'text'
    level: number // 1-10
    text: string // le graphème/syllabe/mot/phrase/texte littéral
    graphemeIds: GraphemeId[] // décomposition explicite, FOURNIE, jamais devinée
    emoji?: string // obligatoire pour kind === 'word'
    skillIds: SkillId[]
    isSightWord?: boolean // mot-outil niveau 8, exempté de décodabilité
    questions?: TextQuestion[] // pour kind === 'text'
  }
  ```

`src/content/corpus.ts` charge et valide (structure seulement — types, champs
requis, `kind` connu, `emoji` présent pour un mot) tous les fichiers de
`corpus/*.json` en un seul tableau `ContentItem[]`, avec détection d'id
dupliqué. **Si vous ajoutez un nouveau fichier `corpus/*.json`, ajoutez-le
aussi à la liste `SOURCES`** en tête de `src/content/corpus.ts` **et** à
`CORPUS_FILENAMES` en tête de `tools/lib/loadContent.mjs` (le vérificateur
Node ne peut pas importer les modules `.ts` de `src/content/`, donc cette
liste est tenue à jour séparément, en miroir — voir `ASSUMPTIONS.md` section
B4).

## Ajouter un mot

1. **Choisir le fichier** selon le niveau : `words-l3-5.json` pour les
   niveaux 3 à 5, `words-l6-7.json` pour les niveaux 6 à 7. (Il n'existe pas
   de fichier `words-l8.json` : à partir du niveau 8, le nouveau vocabulaire
   entre dans les phrases directement, voir plus bas.)

2. **Décomposer le mot en graphèmes déjà enseignés.** `graphemeIds` doit
   contenir uniquement des ids présents dans `curriculum.json` à un niveau
   **inférieur ou égal** au niveau de l'item — c'est la contrainte de
   décodabilité (SPEC §5), vérifiée par machine, jamais par relecture. Le
   découpage est fourni explicitement, jamais deviné à l'exécution : par
   exemple `"chapeau"` se décompose en `["ch", "a", "p", "eau"]`, pas en ses
   lettres brutes. Un mot avec une lettre finale muette (`"chat"`), un *e*
   muet (`"tulipe"`) ou une lettre muette interne doit tout de même
   décomposer *toutes* les lettres écrites — y compris les muettes — avec
   l'id du graphème correspondant enseigné au niveau adéquat (ex. `e-muet`
   pour le *e* final, enseigné dès le niveau 4).

3. **Choisir un emoji non ambigu, non encore utilisé pour un mot différent**
   (`src/content/corpus/*.json`, champ `emoji`, obligatoire pour
   `kind: "word"`). Un même mot répété à deux niveaux peut réutiliser le même
   emoji (ce n'est pas un doublon) ; deux mots différents ne le peuvent pas.

4. **Renseigner `skillIds`** avec l'id (ou les ids) de compétence pertinents
   de `curriculum.json` (ex. `"L3-fusion-cv"`, `"L4-consonnes"`).

5. **Choisir un `id` unique** dans tout le corpus, par convention
   `word-<mot>` (ex. `"word-tulipe"`).

Exemple minimal (niveau 4, avec *e* muet) :

```json
{
  "id": "word-cabane",
  "kind": "word",
  "level": 4,
  "text": "cabane",
  "graphemeIds": ["c-dur", "a", "b", "a", "n", "e-muet"],
  "emoji": "🛖",
  "skillIds": ["L4-consonnes", "L4-e-muet"]
}
```

Un **pseudo-mot** (niveau 7, mécanique « vrai mot / faux mot ») suit
exactement la même forme dans `pseudowords.json`, avec `kind: "pseudoword"`
et **sans** champ `emoji` (les pseudo-mots ne sont jamais illustrés). Voir
`pseudowords.json` pour des exemples (`"tilo"`, `"rabin"`, `"doulan"`…).

## Ajouter une phrase (niveau 8)

Dans `sentences-l8.json`, `kind: "sentence"`, `level: 8`. Deux points
spécifiques aux phrases :

- **`graphemeIds` ne référence que les mots décodables de la phrase.** Les
  mots-outils reconnus globalement au niveau 8 (`le, la, les, un, une, des,
  est, et, dans, sur, avec, il, elle, je, tu, a, ont, qui` — SPEC §5) n'y
  entrent jamais : ils ne sont pas décodés, donc pas décomposés en
  graphèmes.
- Pas d'`emoji` ni de champ `isSightWord` sur l'item `sentence` lui-même :
  `isSightWord` ne s'applique qu'à un `ContentItem` de `kind: "word"`
  représentant un mot-outil isolé, pas à une phrase entière.

```json
{
  "id": "sent-l8-06",
  "kind": "sentence",
  "level": 8,
  "text": "Le vélo est sur le pont.",
  "graphemeIds": ["v", "é", "l", "o", "p", "on"],
  "skillIds": ["L8-mots-outils", "L8-majuscule-point"]
}
```

## Ajouter un mini-texte (niveau 9) ou un texte (niveau 10)

Dans `texts-l9.json` (`level: 9`) ou `texts-l10.json` (`level: 10`),
`kind: "text"`. Deux règles importantes :

- **Une « phrase » d'un texte est une ligne séparée par `\n`** dans le champ
  `text` — pas un découpage par ponctuation (une ligne de dialogue contenant
  un `!` interne fausserait un comptage par signe de ponctuation). Un texte
  niveau 9 doit compter 3 à 5 lignes non vides ; un texte niveau 10, 5 à 6.
- **`questions`** est un tableau de `TextQuestion` :

  ```json
  {
    "id": "text-l9-04-q1",
    "promptKey": "l9-text-04-q1-ou-est-le-chat",
    "answerOptions": ["🏠", "🌳", "🚗"],
    "correctIndex": 0
  }
  ```

  Un texte niveau 9 n'a pas de nombre de questions imposé par le
  vérificateur ; un texte niveau 10 doit en avoir **exactement 2**
  (`tools/lib/checks/counts.mjs`, `L10_QUESTIONS_EXPECTED`).

  **`promptKey` doit avoir une entrée correspondante dans
  `src/content/questionPrompts.json`** (clé → phrase française à énoncer,
  ex. `"l9-text-04-q1-ou-est-le-chat": "Où est le chat ?"`) : sans entrée, le
  compagnon énonce la clé brute en repli plutôt que de planter, mais c'est un
  défaut de contenu à corriger, pas un comportement voulu.

  **Limite connue, à corriger si une future leaf le permet** : la mécanique
  « La question du compagnon »
  (`src/challenges/companionQuestion/CompanionQuestion.tsx`) n'utilise
  aujourd'hui que `questions[0]` d'un texte — le contrat `Challenge` (figé,
  `src/types.ts`) n'a pas de champ pour indiquer quelle question un défi
  précis interroge. Continuez à fournir 2 questions par texte niveau 10 (le
  vérificateur l'exige et c'est ce que demande SPEC §5), mais sachez que la
  seconde n'est pas encore posée en jeu — voir `ASSUMPTIONS.md`.

## Ajouter un graphème ou modifier le curriculum

Les graphèmes eux-mêmes (`curriculum.json`, clé `graphemes`) et leur
prononciation (`pronunciation.json`) changent rarement une fois le
curriculum stabilisé. Si vous en ajoutez un :

1. L'ajouter à `curriculum.json` avec son `level` (niveau où il est enseigné
   pour la première fois) et sa `pronunciationKey`.
2. Ajouter l'entrée correspondante dans `pronunciation.json` : la clé est
   `pronunciationKey`, la valeur est **le son à énoncer, jamais le nom de la
   lettre** (ex. `"m": "mmm"`, `"p": "peu"` — une occlusive brève, pas
   « pé »). C'est la seule source du son d'un graphème dans tout le moteur
   vocal : ne jamais laisser le code énoncer une lettre brute.
3. Si ce graphème doit apparaître comme distracteur visuel ou phonétique
   d'un autre, l'ajouter à `confusion.json` (tableau de graphèmes confusables
   par clé). Les seuls ids acceptés hors du curriculum sont les deux ids
   symboliques `z` et `j` (le son /z/ vient de la règle « s entre voyelles »
   niveau 7, le son /ʒ/ de `g-doux` — voir `ASSUMPTIONS.md` section B3), déjà
   déclarés ; ne pas en ajouter d'autres sans mettre à jour
   `tools/lib/checks/distractors.mjs`.

## Relancer les vérifications

Tout le contenu doit repasser par le vérificateur avant d'être considéré
livrable — jamais par relecture seule :

```bash
node tools/check.mjs all
```

équivalent à `npm run check`. Sous-commandes individuelles (chacune imprime
`0 violation`/`all levels ok`/`coverage 100%`/etc. en cas de succès, sinon
liste chaque violation et quitte en erreur) :

| Commande | Vérifie |
|---|---|
| `node tools/check.mjs content --graphemes` | Chaque item de tout le corpus n'utilise que des `graphemeIds` enseignés à son niveau ou avant (`graphemesKnownAtLevel`, cumulatif niveau 1..N). |
| `node tools/check.mjs content --counts` | Les volumes minimaux de SPEC §5 : 30 syllabes niveau 3, 40 mots par niveau (3 à 7), 25 pseudo-mots niveau 7, 30 phrases niveau 8, 12 textes niveau 9 (3-5 lignes chacun), 4 textes niveau 10 (5-6 lignes et exactement 2 questions chacun). |
| `node tools/check.mjs content --emoji` | Chaque `kind: "word"` a un `emoji` non vide ; aucun emoji n'est partagé par deux mots au `text` différent. |
| `node tools/check.mjs content --pronunciation` | `pronunciation.json` couvre 100 % des `pronunciationKey` de tous les graphèmes déclarés dans `curriculum.json` (une entrée avec une valeur chaîne vide compte comme couverte — cas de `e-muet`, qui n'a pas de son propre). |
| `node tools/check.mjs content --distractors` | (a) chaque id référencé par `confusion.json` est un graphème réel du curriculum ou l'un des deux ids symboliques `z`/`j` ; (b) scan statique de `src/engine/distractors.ts` confirmant qu'aucun tirage aléatoire n'est appliqué au pool brut non filtré (seulement à des variables dérivées d'un `.filter(` sur la confusion ou les items déjà rencontrés). |
| `node tools/check.mjs code --no-hardcoded-content` | Aucune chaîne accentuée en français ni mot-outil (avec espace) en dur dans `src/**/*.{ts,tsx}`, hors `src/content/**`, hors fichiers `*.test.ts(x)`, et hors `src/app/VoiceCheckScreen/**` (seul écran du jeu qui s'adresse à un adulte — voir `ASSUMPTIONS.md`). |
| `node tools/check.mjs self-test --negative-controls` | Contrôle négatif : vérifie que chaque check ci-dessus détecte bien des fixtures délibérément invalides sous `tools/fixtures/invalid/` — pour se prémunir contre un vérificateur qui « passerait » toujours. |

**Rappel (CLAUDE.md règle #2) : jamais un mot, une syllabe ou une phrase en
dur dans le code.** Tout contenu appris par l'enfant vit dans
`src/content/*.json` / `src/content/corpus/*.json`. Le texte d'interface non
pédagogique (phrases du compagnon, libellés de la carte du monde, du Grand
Livre) vit séparément dans `src/content/uiText.json`, chargé via
`src/content/uiText.ts` — jamais écrit en dur dans un composant.

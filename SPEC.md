# SPEC — « Le Royaume des Sons »
## Jeu RPG d'apprentissage de la lecture en français, pour un enfant de 5 ans, sur tablette

> **Invocation prévue :** `/unlazy tree 4` puis « implémente SPEC.md intégralement ».
> Ce document est la source de vérité. Il est écrit pour être consommé sous discipline unlazy v2 :
> les critères d'acceptation de la section 12 sont destinés à être recopiés dans `GATES.md` et
> `gates/*.md` **avant** tout travail réel, avec leurs lignes `CHECK:` / `EXPECT:`.

---

## 0. Mode de travail (unlazy)

- **Mode : orchestré.** L'arbre a 4 niveaux : la tâche (L1), 6 branches (L2), leaves de travail réel (L3-L4).
- **Rule zero.** Avant d'écrire une ligne de code : `PLAN.md` (contrat : arborescence de fichiers, interfaces TypeScript partagées, conventions de nommage, propriété des fichiers par leaf) puis un fichier de gates par leaf sous `gates/`. Les gates de la section 12 sont le point de départ, pas la liste finale : chaque leaf ajoute les siens.
- **Contrats avant fan-out.** Les types du domaine (`Grapheme`, `Skill`, `ContentItem`, `Challenge`, `MasteryState`, `SaveFile`, `NarrationRequest`) sont figés dans `src/types.ts` et dans `PLAN.md` avant qu'une seule leaf ne démarre.
- **Gates d'intégration** sur chaque branche : les leaves peuvent toutes être vertes et le produit cassé.
- **Report audit.** Tout nombre du rapport final est re-mesuré au moment du rapport (`node tools/check.mjs report`), jamais écrit de mémoire.
- **ABANDON** : si un gate devient impossible (par exemple aucune voix française sur la machine de dev), écrire `ABANDON: <id> <raison>` plutôt que de le décocher en silence.
- Ne me pose aucune question. Consigne chaque décision prise en l'absence de précision dans `ASSUMPTIONS.md`.

### Arbre imposé (ne pas ré-inventer la décomposition)

```
L1  Le Royaume des Sons
├── A  Socle technique          (app shell, voix, sauvegarde, navigation non-lisante)
│   ├── A1 shell PWA + routage + plein écran/standalone
│   ├── A2 module voix (speak, file d'attente, watchdog, table de prononciation)
│   ├── A3 persistance (localStorage, schéma versionné, migration, export/import)
│   └── A4 système de narration d'écran (aucun écran sans narration)
├── B  Contenu pédagogique      (curriculum, corpus, vérificateur)
│   ├── B1 modèle de données du curriculum + 10 niveaux + compétences
│   ├── B2 corpus (graphèmes, syllabes, mots, phrases, textes) + emoji
│   ├── B3 table de confusion (distracteurs) + table de prononciation
│   └── B4 tools/check.mjs : contraintes de contenu vérifiables
├── C  Mécaniques de défi       (les 6 types)
├── D  Moteur de progression    (maîtrise, répétition espacée, aide graduée, anti-devinette)
├── E  Monde RPG                (carte, régions, quêtes, boss, avatar, récompenses, Grand Livre)
└── F  Parent & livraison       (écran parent, README, e2e, audit final)
```

---

## 1. Contexte joueur (déterminant pour tout le reste)

- Garçon de **5 ans**, francophone (français québécois).
- **Il connaît le nom des lettres mais pas leurs sons.** C'est le point de départ exact : il dira « ème » pour `m`. Le niveau 1 doit donc contenir un moment explicite d'enseignement de la distinction *nom de la lettre* / *son de la lettre*, et le jeu ne doit **jamais** dire le nom d'une lettre quand il en enseigne le son.
- **Tablette tactile**, il joue **seul**, sans adulte à côté.
- Il **ne sait pas lire** : toute consigne écrite est inutilisable au départ.

---

## 2. Règle absolue d'autonomie

1. **Aucune navigation, consigne ou rétroaction ne dépend de la lecture.** Chaque écran est narré à voix haute dès son apparition ; chaque bouton porte une icône ; les libellés textuels sont décoratifs jusqu'au niveau 8.
2. Un seul geste possible à la fois autant que possible ; un seul bouton mis en évidence.
3. **Jamais** de message d'erreur, de boîte de dialogue système, de « game over », de compte à rebours, de minuteur visible.
4. L'échec est doux et sans perte : l'ennemi « se relève », le compagnon encourage, on recommence.
5. Aucune monétisation, publicité, lien externe, partage, réseau. Aucune saisie de texte libre par l'enfant.
6. Sessions courtes par conception : une quête dure 3 à 6 minutes. Après 20 minutes cumulées, le compagnon **propose** une pause (l'enfant peut refuser) ; après 40 minutes, il la propose de nouveau. Jamais de blocage autoritaire.

---

## 3. Contraintes techniques

**Pile.** Vite + React + TypeScript. `vitest` pour les tests unitaires, `playwright` pour 4-6 tests e2e headless. Zéro dépendance réseau à l'exécution. Aucun backend, aucun compte.

**Cible.** iPad Safari 17+ et Android Chrome, paysage. Ordinateur toléré pour le développement mais non optimisé.

**Interaction tactile.**
- Zones tactiles ≥ 64 × 64 px CSS, espacées d'au moins 16 px.
- **Pas de glisser-déposer, pas de survol, pas de double-tap.** Pour assembler : on touche une pièce (elle se soulève), on touche un emplacement (elle s'y pose). Toucher une pièce déjà posée la renvoie à sa réserve.
- `touch-action: manipulation`, désactivation du zoom par double-tap, `user-select: none`, `overscroll-behavior: none` pour éviter le pull-to-refresh en plein jeu.
- Respecter `prefers-reduced-motion`.

**Voix — c'est le point de rupture du projet, traite-le comme une leaf à part entière (A2).**
- `window.speechSynthesis`, voix `fr-CA` en priorité, sinon `fr-FR`, sinon toute voix `fr-*`.
- La liste des voix se charge de façon asynchrone : attendre `voiceschanged`, avec un délai de garde.
- L'audio ne peut démarrer qu'après un geste utilisateur : le premier écran est un gros bouton « Jouer » qui amorce la voix.
- Module `speak()` centralisé : file d'attente sérialisée, annulation propre au changement d'écran, débit ~0,85, **watchdog** (si `onstart` ne se déclenche pas en 600 ms, annuler et réessayer une fois ; au deuxième échec, afficher l'icône « son muet » et continuer sans bloquer le jeu), et parade au gel de l'API iOS (`pause()`/`resume()` périodique pendant les longues énonciations).
- **Table de prononciation graphème → texte à énoncer**, dans `src/content/pronunciation.json`, pour que le son de `m` soit énoncé « mmm » et non « ème », `p` « peu » (occlusive brève, pas « pé »), etc. Cette table est du contenu, pas du code, et doit couvrir 100 % des graphèmes du curriculum.
- **Écran de vérification de la voix au premier lancement** : le jeu énonce une phrase test et demande à l'adulte de confirmer qu'il entend une voix française. Si aucune voix `fr-*` n'existe, afficher une page d'explication destinée à l'adulte (avec la marche à suivre iOS/Android pour installer une voix française) — c'est le seul écran du jeu qui s'adresse à un lecteur adulte.

**Persistance.**
- `localStorage`, schéma **versionné** (`schemaVersion`) avec fonction de migration et test de migration.
- Écriture après chaque défi, pas seulement en fin de quête : l'app peut être tuée à tout moment. Reprise exacte au défi en cours après rechargement.
- **Risque connu à traiter, pas à ignorer :** sur iOS, le stockage d'un site web ordinaire peut être purgé après 7 jours sans visite. Mitigation : (a) le README impose l'ajout à l'écran d'accueil (mode standalone, exempté de la purge) ; (b) l'écran parent affiche la date de la dernière sauvegarde et propose un export JSON ; (c) rappel d'export automatique tous les 10 jours de jeu.

**Plein écran.**
- Ne pas dépendre de `requestFullscreen` (support inégal sur iOS). La cible est le **mode standalone** via ajout à l'écran d'accueil (`display: standalone` dans le manifeste, `apple-mobile-web-app-capable`).
- Le README doit expliquer **l'accès guidé (iOS) / l'épinglage d'app (Android)** : sans cela, un enfant de 5 ans quittera le jeu en trois secondes. C'est une instruction de livraison, pas une option.

**PWA / service worker.** Manifeste + service worker de cache simple, avec numéro de version dans le nom du cache et bouton « vider le cache et recharger » dans l'écran parent. Si le service worker s'avère instable, le désactiver et l'écrire dans `ASSUMPTIONS.md` plutôt que de livrer un cache empoisonné.

**Assets.** Aucune image externe, aucun binaire téléchargé. SVG inline, formes géométriques simples, animations CSS. Les mots sont illustrés par des **emoji** dans un cadre stylisé ; **un mot n'entre dans le corpus que s'il a un emoji non ambigu** (contrainte vérifiée par le checker).

**Typographie.** Police pensée pour l'apprentissage : Andika, sinon Atkinson Hyperlegible, sinon sans-serif système — **avec un « a » à un seul étage**, obligatoire. Police embarquée localement (pas de CDN). Taille minimale 36 px pour tout ce qui doit être lu par l'enfant, interlettrage légèrement augmenté, minuscules d'imprimerie uniquement jusqu'au niveau 8.

**Couleur.** Palette de 6 à 8 couleurs, contraste ≥ 4.5:1. La réussite et l'échec ne sont **jamais** signalés par la seule couleur : forme + son + animation + phrase du compagnon.

**Contenu séparé du code.** Tout le matériel pédagogique vit dans `src/content/*.json`. Le code ne contient aucun mot, syllabe ou phrase en dur.

---

## 4. Univers et boucle de jeu

- Titre : « Le Royaume des Sons » (améliorable).
- L'enfant choisit un **avatar** parmi 4 (SVG simple, non genré) et un **compagnon magique** qui parle : c'est la voix du jeu, le narrateur, le guide et celui qui aide.
- Prémisse : un sortilège a brouillé tous les mots du royaume ; le héros apprend la magie des sons pour les réparer, région par région.
- **Carte du monde** : 10 régions, débloquées en séquence, une par niveau (section 5). Chaque région contient 4 à 6 quêtes ; la dernière est un boss.
- **Quête** = 8 à 12 défis enchaînés (section 6), tirés des compétences de la région, avec réinjection des erreurs passées (section 7). Réussir un défi = lancer un sort qui frappe l'ennemi ou répare un élément du décor.
- **Récompenses** : barre d'XP, pièces, cosmétiques pour l'avatar et le compagnon (chapeaux, capes, montures), et le **Grand Livre** qui se remplit des mots, phrases et textes maîtrisés — consultable et réécoutable à volonté. Le Grand Livre est la passerelle vers les vrais livres : à partir du niveau 8, il affiche les textes sans aide, comme une page de livre.
- Style indie : coloré, chaleureux, lisible ; pas de réalisme, pas de menace, pas de violence (les « ennemis » sont des créatures de brume qui se dissipent).

---

## 5. Curriculum — 10 niveaux

Méthode syllabique explicite. Chaque niveau = une région = un ensemble de compétences ; chaque compétence doit être maîtrisée (section 7) pour débloquer le boss, et le boss débloque la région suivante.

**Décision pédagogique structurante :** le **e muet final** est enseigné dès le niveau 4, pas à la fin. Sans lui, le vocabulaire décodable des premiers niveaux est famélique (il exclut tomate, patate, banane, cabane, pirate, salade, tulipe, olive…). Formulation pour l'enfant : « le `e` de la fin ne se dit pas, mais il réveille la lettre d'avant ».

| N° | Région | Contenu enseigné |
|----|--------|------------------|
| 1 | La Clairière des Voyelles | Distinction nom/son de la lettre. Sons de **a, i, o, u, é**. Lettre → son, son → lettre. |
| 2 | La Forêt des Premières Consonnes | **l, m, r, s, p, t**. Lettre → son, son → lettre. |
| 3 | Le Pont des Syllabes | Fusion CV avec N1+N2 (ma, li, ro, su, pé, ta…). Entendre → choisir ; assembler deux lettres ; lire une syllabe. Premiers mots : papa, moto, loto, puma, lama, mari, salami, météo, totem, ami. |
| 4 | Le Village des Mots | **f, v, n, d, b, c dur, g dur, k** + **e muet final**. Mots de 2-3 syllabes : tomate, patate, banane, cabane, domino, robot, tulipe, vélo, sofa, farine, café, dame, cube, note, bébé, olive, canif. |
| 5 | La Grotte des Sons qui claquent | Syllabes inversées (al, is, or, ec) et mots CVC : sac, bol, lac, bec, sel, vif, film, parc, tulipe→ *déjà vu*, mardi, tortue. Aide mnémotechnique parlée pour **b/d/p/q**. |
| 6 | Le Lac des Sons à deux lettres | **ou, on, an/en, in, oi, eu, ch, gn, au/eau, ai/ei**. Mots : chou, poule, boule, bouton, moulin, poire, chapeau, montagne, dinosaure, fusée. |
| 7 | Le Marais des Lettres muettes | Consonne finale muette (chat, loup, grand, petit, nid), **s = z** entre voyelles (rose, chaise), **c doux** (ce, ci), **g doux** (ge, gi), **qu**, **ph**, pluriel en -s. Introduction du défi *vrai mot / faux mot* (pseudo-mots : « tilo », « rabin »). |
| 8 | La Route des Phrases | Mots-outils reconnus globalement : le, la, les, un, une, des, est, et, dans, sur, avec, il, elle, je, tu, a, ont, qui. Majuscule de début de phrase et point. Phrases de 3 à 6 mots. |
| 9 | La Tour des Histoires | Mini-textes de 3 à 5 phrases illustrés, questions de compréhension orales. Introduction de `?`, `!`, du dialogue simple et du tiret de dialogue. |
| 10 | Le Château du Sortilège | **Boss final** : lire seul un texte de 5 à 6 phrases (seule aide restante : réécouter **un** mot, ce qui compte comme indice) puis répondre à 2 questions. Réussite → générique, le compagnon annonce que le héros est prêt pour les vrais livres, déblocage du **mode aventure libre** (rejouer n'importe quelle région) et du Grand Livre complet. |

### Contrainte de décodabilité (non négociable)

**Un mot, une phrase ou un texte ne peut contenir que des graphèmes déjà enseignés à son niveau ou avant**, à la seule exception des mots-outils du niveau 8, déclarés explicitement comme reconnus globalement dans le corpus.

Cette contrainte est facile à énoncer et **très facile à violer sans s'en rendre compte** — « chat » et « dent » ont une consonne finale muette, « malade » et « pirate » un e muet, « loup » un p muet. Elle doit donc être **vérifiée par programme** sur 100 % du corpus (`tools/check.mjs content --graphemes`), et non par relecture. Le découpage d'un mot en graphèmes est fourni explicitement dans le corpus (`"chapeau": ["ch","a","p","eau"]`) : ne pas tenter de le deviner à l'exécution.

### Volumes minimaux du corpus

| Élément | Minimum |
|---|---|
| Graphèmes couverts par la table de prononciation | 100 % de ceux du curriculum |
| Syllabes CV, niveau 3 | 30 |
| Mots, niveaux 3 à 7 | **40 par niveau** (200 au total), tous avec emoji non ambigu |
| Pseudo-mots, niveau 7 | 25 |
| Phrases, niveau 8 | 30 |
| Phrases et mini-textes, niveau 9 | 12 textes de 3 à 5 phrases |
| Textes, niveau 10 | 4 textes de 5 à 6 phrases + 2 questions chacun |

Ces nombres sont des gates comptés par machine, pas des ordres de grandeur. Si un volume est atteint en dégradant la qualité (mots sans emoji clair, phrases absurdes), c'est un échec : améliorer le corpus, pas gonfler le compte.

---

## 6. Les 6 mécaniques de défi

1. **Écoute et touche** — le compagnon énonce un son, une syllabe ou un mot ; 3 ou 4 cartes ; toucher la bonne.
2. **Forge** — assembler des pièces (lettres ou syllabes) pour former ce qu'on entend ou ce que l'image montre. Distracteurs présents. Pièce mal placée : elle retourne à sa réserve avec un son doux, sans pénalité.
3. **Lis et montre** — un mot ou une phrase écrite, toucher l'image correspondante parmi 3.
4. **Vrai mot / faux mot** — niveau 7+, force le décodage plutôt que la reconnaissance globale.
5. **Remets en ordre** — niveau 8+, replacer 2 à 4 mots pour reconstituer une phrase entendue.
6. **La question du compagnon** — niveau 9+, question orale après un texte, réponses en images ou mots courts.

Pour chaque défi : consigne énoncée à voix haute, élément écrit affiché en grand, réponse, rétroaction immédiate (animation + son + phrase du compagnon). **Après une bonne réponse, le jeu relit le mot ou la phrase en surlignant les syllabes une à une** — c'est la modélisation du décodage, elle ne doit jamais être sautée.

---

## 7. Moteur de progression

**Maîtrise.** Chaque compétence a un score. Une compétence est maîtrisée quand **8 des 10 dernières réponses sont correctes et sans indice**. La réécoute de la consigne ne compte pas comme un indice (sauf au niveau 10). Passer de niveau exige la maîtrise de **toutes** les compétences du niveau **et** la réussite du boss. Ni le temps de jeu ni le nombre de tentatives ne débloquent quoi que ce soit.

**Décroissance.** Après 14 jours sans jouer, les compétences maîtrisées repassent sous le seuil et sont réinjectées en révision — sans jamais faire redescendre le niveau affiché ni retirer une récompense. L'enfant ne doit jamais avoir l'impression de perdre.

**Répétition espacée.** Chaque erreur crée un item de révision sur le graphème ou le mot précis, réinjecté après 1, 3 puis 8 quêtes. Environ **25 %** des défis d'une quête sont des révisions (compté par le checker sur une quête simulée).

**Distracteurs.** Jamais aléatoires : issus d'une **table de confusion** explicite dans le corpus — visuelle (b/d/p/q, m/n, u/n, ou/on) et phonétique (f/v, s/z, p/b, t/d, ch/j). Un distracteur doit toujours être un item déjà rencontré ou un voisin proche de la cible.

**Anti-position.** La bonne réponse n'occupe jamais deux fois de suite la même position ; l'ordre des cartes est retiré à chaque défi ; contrôlé par test statistique sur 1000 tirages.

**Anti-devinette.** Si l'enfant répond **de façon incorrecte** en moins de 700 ms deux fois de suite, le compagnon dit « Écoute bien » et rejoue la consigne avant d'accepter la réponse suivante. Une bonne réponse rapide n'est **jamais** pénalisée : c'est de la fluidité, précisément l'objectif.

---

## 8. Aide graduée

L'enfant demande de l'aide ; le jeu ne la devance pas. Deux boutons permanents à droite, avec icônes :

- **Oreille** — réécouter la consigne. Gratuit, illimité, sans effet sur la maîtrise (sauf niveau 10).
- **Lanterne** — indice, gradué selon le nombre d'appuis dans le même défi :
  1. le compagnon énonce le son de la première lettre ou syllabe et la surligne ;
  2. une mauvaise option disparaît ;
  3. la bonne réponse clignote — l'enfant doit quand même la toucher, et le même défi revient plus tard dans la quête, sans indice.

Après **2 mauvaises réponses** sur un défi : le compagnon montre la bonne réponse, la lit en la décodant syllabe par syllabe, puis repropose le même défi.

Après **3 défis consécutifs échoués malgré les indices** : écran « Va chercher un grand » — icône d'adulte, main tendue, phrase énoncée à voix haute, aucun texte requis. Un bouton permet de reprendre à tout moment. L'événement est journalisé pour l'écran parent.

Rien de tout cela ne retire de récompense. L'aide retarde la maîtrise, elle ne punit pas.

---

## 9. Écran parent

Accès caché : appui long de 3 secondes sur le coin supérieur gauche, puis une addition à deux chiffres à résoudre sur un pavé numérique.

Contenu : niveau et région en cours ; maîtrise par compétence ; les 10 erreurs les plus fréquentes ; temps de jeu par jour sur 14 jours ; nombre d'appels « Va chercher un grand » ; date de la dernière sauvegarde ; export et import JSON ; réinitialisation avec double confirmation ; réglage de la vitesse de la voix ; sélection de la voix parmi celles disponibles ; test de la voix ; bouton « vider le cache et recharger ».

---

## 10. Ce que le jeu ne prétend pas faire

À écrire dans le README, et à ne pas surpromettre dans le jeu : le niveau 10 valide le **décodage autonome** d'un texte court, pas la **fluidité**. La fluidité vient de la lecture de vrais livres. Le compagnon oriente explicitement vers les livres papier à la fin, et le Grand Livre sert de pont.

---

## 11. Passes par leaf (unlazy)

Pour chaque leaf, dans l'ordre : **implémenter complètement** (aucun TODO, aucun placeholder, aucune fonction stub) → **relire en expert du domaine** (nommer la version paresseuse de chaque partie et la remplacer) → **chasser les défauts** (cas limites, correction, ce qui « sonne faux » pédagogiquement) → **polir à coût nul**. Une passe qui ne trouve rien, plus un fichier de gates entièrement coché avec preuves, est la seule ligne d'arrivée.

---

## 12. Gates de départ

À recopier dans `GATES.md` (racine) et à répartir dans `gates/<leaf>.md`. Chaque leaf ajoute ses propres gates ; ceux-ci sont le plancher, pas le plafond. Les commandes `CHECK:` doivent exister — écrire `tools/check.mjs` (Node, sans dépendance) comme une leaf à part entière de la branche B.

```
# Gates: Le Royaume des Sons

## Contenu

- [ ] G-B1: chaque item du corpus n'utilise que des graphèmes enseignés à son niveau ou avant
  CHECK: node tools/check.mjs content --graphemes
  EXPECT: 0 violation
  EVIDENCE: pending

- [ ] G-B2: volumes minimaux du corpus atteints (section 5)
  CHECK: node tools/check.mjs content --counts
  EXPECT: all levels ok
  EVIDENCE: pending

- [ ] G-B3: chaque mot du corpus a un emoji associé, aucun emoji réutilisé pour deux mots
  CHECK: node tools/check.mjs content --emoji
  EXPECT: 0 missing, 0 duplicate
  EVIDENCE: pending

- [ ] G-B4: la table de prononciation couvre 100% des graphèmes du curriculum
  CHECK: node tools/check.mjs content --pronunciation
  EXPECT: coverage 100%
  EVIDENCE: pending

- [ ] G-B5: chaque distracteur provient de la table de confusion ou d'items déjà rencontrés
  CHECK: node tools/check.mjs content --distractors
  EXPECT: 0 random distractor
  EVIDENCE: pending

- [ ] G-B6: aucun mot, syllabe ou phrase en dur dans src/ hors de src/content/
  CHECK: node tools/check.mjs code --no-hardcoded-content
  EXPECT: 0 occurrence
  EVIDENCE: pending

## Moteur

- [ ] G-D1: maîtrise = 8/10 dernières réponses correctes sans indice, testé sur séquences synthétiques
  CHECK: npx vitest run src/engine/mastery.test.ts
  EXPECT: all tests pass
  EVIDENCE: pending

- [ ] G-D2: répétition espacée réinjecte à 1, 3 et 8 quêtes; ~25% de révisions par quête
  CHECK: npx vitest run src/engine/spacing.test.ts
  EXPECT: all tests pass
  EVIDENCE: pending

- [ ] G-D3: la bonne réponse n'est jamais deux fois de suite à la même position (1000 tirages)
  CHECK: npx vitest run src/engine/shuffle.test.ts
  EXPECT: all tests pass
  EVIDENCE: pending

- [ ] G-D4: aucun niveau ne se débloque sans maîtrise complète + boss
  CHECK: npx vitest run src/engine/progression.test.ts
  EXPECT: all tests pass
  EVIDENCE: pending

- [ ] G-D5: l'anti-devinette ne se déclenche que sur réponses fausses rapides
  CHECK: npx vitest run src/engine/antiguess.test.ts
  EXPECT: all tests pass
  EVIDENCE: pending

- [ ] G-A3: migration de schéma de sauvegarde v1→courant sans perte
  CHECK: npx vitest run src/save/migration.test.ts
  EXPECT: all tests pass
  EVIDENCE: pending

## Autonomie et interface

- [ ] G-A4: chaque écran déclare une narration non vide
  CHECK: npx vitest run src/ui/narration.test.ts
  EXPECT: 0 screen without narration
  EVIDENCE: pending

- [ ] G-F1: parcours e2e complet niveau 1 → boss 1 sans lire une consigne écrite
  CHECK: npx playwright test e2e/level1.spec.ts
  EXPECT: 1 passed
  EVIDENCE: pending

- [ ] G-F2: toutes les zones tactiles interactives font au moins 64x64 px en 1024x768
  CHECK: npx playwright test e2e/tap-targets.spec.ts
  EXPECT: 0 undersized target
  EVIDENCE: pending

- [ ] G-F3: rechargement en plein milieu d'une quête reprend au même défi
  CHECK: npx playwright test e2e/resume.spec.ts
  EXPECT: 1 passed
  EVIDENCE: pending

- [ ] G-F4: aucune requête réseau après le chargement initial
  CHECK: npx playwright test e2e/offline.spec.ts
  EXPECT: 0 runtime request
  EVIDENCE: pending

- [ ] G-F5: build et typecheck propres
  CHECK: npm run typecheck && npm run build
  EXPECT: exit 0, 0 error
  EVIDENCE: pending

## Livraison

- [ ] G-F6: README couvre lancement, ajout à l'écran d'accueil, accès guidé iOS / épinglage Android, installation d'une voix française, export de sauvegarde
  EVIDENCE: pending

- [ ] G-F7: ASSUMPTIONS.md liste chaque décision prise sans consigne
  EVIDENCE: pending

- [ ] G-F8: CONTENT.md explique comment ajouter un mot, une phrase ou un texte et relancer les checks
  EVIDENCE: pending

- [ ] G-F9: tous les nombres du rapport final ont été re-mesurés au moment du rapport
  CHECK: node tools/check.mjs report
  EXPECT: all figures re-measured
  EVIDENCE: pending
```

---

## 13. Rapport final attendu

Coller le ledger complet, N sur N, avec pour chaque gate sa preuve. Y ajouter :
la liste des gates `ABANDON` avec raison ; les limites connues (notamment `speechSynthesis` sur iOS) ;
et la marche à suivre en trois lignes pour lancer le jeu sur la tablette.

# CLAUDE.md — Le Royaume des Sons

> À placer à la racine du dépôt. Claude Code le lit au début de chaque session.
> Garde-le court : c'est un rappel de règles, pas une deuxième spécification.

## Ce projet

Jeu web RPG qui apprend à lire en français à un enfant de 5 ans, sur tablette tactile,
en autonomie. La spécification complète et faisant autorité est **SPEC.md**. En cas de
contradiction entre ce fichier et SPEC.md, **SPEC.md gagne**.

## Discipline

Ce projet tourne sous le skill **unlazy** (`.claude/skills/unlazy`). Rule zero : les gates
sont écrits dans des fichiers **avant** le travail. `GATES.md` à la racine, un fichier par
leaf sous `gates/`. Rien n'est « fait » sans case cochée et preuve mesurée.

- Vérifier les gates : `npm run gates`
- Vérifier le contenu : `npm run check`
- Avant tout rapport : `npm run typecheck && npm run test && npm run e2e`

## Règles non négociables

1. **L'enfant ne sait pas lire.** Aucune navigation, consigne ou rétroaction ne peut
   dépendre de la lecture. Chaque écran est narré. Chaque bouton a une icône.
2. **Aucun mot, syllabe ou phrase en dur dans le code.** Tout le contenu pédagogique
   vit dans `src/content/*.json`.
3. **Contrainte de décodabilité.** Un item ne peut contenir que des graphèmes déjà
   enseignés à son niveau ou avant. Vérifiée par `node tools/check.mjs content --graphemes`,
   jamais par relecture.
4. **Zones tactiles ≥ 64×64 px.** Pas de glisser-déposer, pas de survol, pas de double-tap.
5. **Aucune requête réseau à l'exécution.** Aucun CDN, aucune police distante, aucune image
   externe. Les polices sont dans `public/fonts/`.
6. **Aucune donnée personnelle.** Le jeu ne demande jamais de nom, d'âge, de photo.
   Le dépôt est public : rien qui identifie l'enfant, nulle part, y compris dans les
   commentaires, les commits et les fichiers de contenu.
7. **Jamais de placeholder, de TODO, de fonction stub** dans une leaf déclarée terminée.

## Git

- Un commit par leaf terminée et verte. Message : `feat(<leaf>): <quoi>` + `Gates: N/N`.
- Ne jamais committer avec `typecheck` ou `test` en échec.
- `main` doit toujours builder : le workflow Pages déploie à chaque push.

## Environnement

- Windows / PowerShell. Node 22. Vite + React + TypeScript, vitest, Playwright (chromium).
- `npm run dev` sert sur le réseau local (`--host`) pour les tests rapides sur tablette,
  mais **le service worker et l'ajout à l'écran d'accueil exigent HTTPS** : la vraie
  validation tablette se fait sur l'URL GitHub Pages.
- `base` de Vite est calé sur le nom du dépôt. Ne pas le changer sans mettre à jour le
  manifeste PWA et les chemins d'assets.

## Pièges déjà identifiés (ne pas les redécouvrir)

- `speechSynthesis` : la liste des voix se charge de façon asynchrone (`voiceschanged`),
  l'audio exige un geste utilisateur préalable, et l'API peut geler sur iOS. Watchdog
  obligatoire, voir SPEC §3.
- Le son d'une lettre n'est pas son nom. La table `src/content/pronunciation.json` est
  la seule source : ne jamais laisser le moteur énoncer une lettre brute.
- `localStorage` peut être purgé sur iOS après 7 jours sans visite si l'app n'est pas
  ajoutée à l'écran d'accueil. Export JSON obligatoire dans l'écran parent.
- Le `e` muet final est enseigné au niveau 4, pas plus tard : sans lui le corpus des
  premiers niveaux est trop pauvre.

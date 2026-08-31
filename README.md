# Le Royaume des Sons

Jeu web RPG qui apprend à lire en français à un enfant de 5 ans, sur tablette
tactile, en autonomie (sans lecture requise pour naviguer). Toute la
spécification pédagogique et technique est dans [`SPEC.md`](./SPEC.md) ;
les règles de contribution non négociables sont dans
[`CLAUDE.md`](./CLAUDE.md).

**Cible : tablette Android, Chrome, en mode paysage.** iOS et Safari sont
**hors périmètre** — c'est un choix assumé (voir SPEC §3), pas un oubli :
aucun code, aucune mitigation ni aucune instruction de livraison spécifique à
iOS/Safari/WebKit ne sera fournie. Un ordinateur de bureau est toléré pour le
développement mais n'est pas une cible optimisée.

## Lancement

```bash
npm install
npm run dev       # sert le jeu en développement, avec rechargement à chaud
npm run build       # build de production dans dist/
npm run preview      # sert le build de production localement
```

Le script `dev` (`vite --host`, voir `package.json`) écoute déjà sur toutes
les interfaces réseau par défaut, pas seulement `localhost` : c'est ce qui
permet d'ouvrir le jeu depuis le navigateur d'une tablette sur le même réseau
Wi-Fi, sans rien ajouter à la commande, en visitant l'adresse IP affichée
dans le terminal (par exemple `http://192.168.1.42:5173/royaume-des-sons/`).

**Important : le service worker et l'ajout à l'écran d'accueil (mode
« standalone ») exigent HTTPS.** Le serveur de développement local tourne en
HTTP simple : il est utile pour itérer rapidement sur l'interface et le
gameplay, mais **la validation réelle du mode hors-ligne, de l'installation en
PWA et du plein écran standalone se fait uniquement sur l'URL GitHub Pages**
(HTTPS), qui se déploie automatiquement à chaque push sur `main` :

```
https://johnfrancislyonsmcalpin-droid.github.io/royaume-des-sons/
```

## Ajout à l'écran d'accueil (PWA)

Le jeu est une PWA installable (manifeste `public/manifest.webmanifest`,
mode `display: standalone`). Sur la tablette Android, dans Chrome, ouvrir
l'URL GitHub Pages ci-dessus, puis :

1. Menu ⋮ (trois points, en haut à droite de Chrome)
2. **Ajouter à l'écran d'accueil** (ou **Installer l'application**)
3. Confirmer

L'icône ajoutée lance ensuite le jeu en plein écran, sans barre d'adresse ni
interface de navigateur (`display: standalone`), ce qui est important pour
qu'un enfant de 5 ans ne quitte pas le jeu par erreur en touchant un bouton du
navigateur.

## Plein écran et épinglage d'écran Android

Le mode standalone (ci-dessus) couvre déjà la majorité du plein écran. En
complément, `requestFullscreen` est déclenché automatiquement sur le premier
geste de l'enfant si le jeu est ouvert dans un onglet de navigateur plutôt que
depuis l'icône ajoutée à l'écran d'accueil.

Ni l'un ni l'autre n'empêche un enfant de quitter l'application avec le bouton
« Accueil » ou « Récents » du système Android. Pour une session vraiment sans
échappatoire, **épingler l'écran** avant de donner la tablette :

> **Paramètres > Sécurité > Épinglage d'écran**

Activer l'option, puis, une fois le jeu ouvert, ouvrir la liste des
applications récentes et épingler le jeu (icône punaise sur la vignette de
l'application). Pour désépingler, maintenir les boutons Retour et Aperçu
enfoncés simultanément (ou suivre l'invite affichée par Android selon la
version).

## Voix : installer un pack vocal français

Le jeu ne fonctionne correctement que si Android dispose d'une voix de
synthèse vocale française (`fr-CA` en priorité, sinon `fr-FR`, sinon toute
voix `fr-*`) : c'est le compagnon qui narre chaque écran, chaque consigne et
chaque rétroaction. **Au tout premier lancement, un écran de vérification de
la voix s'affiche automatiquement** (le seul écran du jeu qui s'adresse à un
lecteur adulte, voir `src/app/VoiceCheckScreen/`) : il fait entendre une
phrase de test et demande de confirmer si une voix française a bien été
entendue. Si aucune voix française n'est détectée, l'écran affiche la marche
à suivre suivante pour l'installer :

> Paramètres > Système > Langues > Synthèse vocale > moteur **Google
> Text-to-Speech** > paramètres du moteur > installer les données vocales du
> **français**

Cet écran de vérification peut aussi être rouvert à tout moment depuis
l'écran parent (section « Voix », bouton « Tester », voir plus bas), qui
permet en plus de choisir la voix installée à utiliser et d'ajuster sa
vitesse.

## Écran parent

L'écran parent regroupe le suivi de la progression, les réglages de voix,
l'export/import de sauvegarde et la réinitialisation. Il est volontairement
inaccessible à l'enfant (SPEC §9) : aucun bouton visible n'y mène.

**Pour l'ouvrir :**

1. Appuyer et **maintenir 3 secondes** le coin supérieur gauche de l'écran
   (zone invisible, sans retour visuel — c'est voulu).
2. Résoudre l'**addition à deux chiffres** affichée sur le pavé numérique qui
   apparaît, puis valider.

Une fois ouvert, l'écran parent affiche : le niveau et la région en cours,
la maîtrise par compétence, les erreurs les plus fréquentes, le temps de jeu
par jour sur 14 jours, le nombre d'appels « Va chercher un grand », la date
de dernière sauvegarde, les réglages de voix (vitesse, sélection de voix,
test), l'export et l'import JSON, la réinitialisation (à double confirmation)
et un bouton « vider le cache et recharger ».

### Export de sauvegarde

Le jeu sauvegarde automatiquement dans `localStorage` après chaque défi (pas
seulement en fin de quête) : recharger la page reprend exactement là où
l'enfant s'était arrêté. Sur la cible Android/Chrome, `localStorage` n'est pas
purgé après une période d'inactivité (ce risque est spécifique à iOS/Safari,
hors périmètre — voir CLAUDE.md). L'export JSON reste néanmoins le filet de
sécurité recommandé en cas de changement d'appareil, de désinstallation ou
d'effacement manuel du stockage du navigateur :

1. Ouvrir l'écran parent (voir ci-dessus).
2. Section **Export / import** > bouton **Exporter**.
3. Un aperçu JSON s'affiche ; bouton **Télécharger le fichier** pour
   enregistrer `royaume-des-sons-sauvegarde.json`.

Pour restaurer une sauvegarde exportée : coller son contenu JSON dans le champ
**Coller une sauvegarde exportée** de la même section, puis **Importer**.
L'écran parent rappelle la date de dernière sauvegarde et recommande un
export tous les 10 jours de jeu.

## Ce que le jeu ne prétend pas faire

Le niveau 10 (boss final) valide le **décodage autonome** d'un texte court de
5 à 6 phrases : l'enfant est capable de déchiffrer seul, avec pour seule aide
restante la réécoute d'un mot. Ce n'est **pas** un objectif de **fluidité de
lecture** — la fluidité ne s'acquiert qu'avec la pratique répétée de vrais
livres, ce que ce jeu ne remplace pas. À la fin du parcours, le compagnon
oriente explicitement l'enfant vers de vrais livres papier, et le Grand Livre
(la collection de mots, phrases et textes maîtrisés en jeu, réécoutable à
volonté) sert de pont entre le jeu et cette étape suivante.

## Contenu pédagogique

Voir [`CONTENT.md`](./CONTENT.md) pour la structure du curriculum et du
corpus, comment ajouter un mot, une phrase ou un texte, et comment relancer
les vérifications automatiques du contenu.

## Développement

Pile : Vite + React + TypeScript, `vitest` pour les tests unitaires,
`playwright` (chromium) pour les tests de bout en bout. Zéro dépendance
réseau à l'exécution, aucun backend, aucun compte.

```bash
npm run typecheck   # tsc -b (build TypeScript multi-projets)
npm run test        # vitest run
npm run e2e          # playwright test
npm run check         # node tools/check.mjs all — vérifie le contenu pédagogique
npm run lint          # oxlint
```

Avant tout rapport de travail, la discipline du projet (voir CLAUDE.md)
exige : `npm run typecheck && npm run test && npm run e2e`.

`base` dans `vite.config.ts` est calé sur le nom du dépôt GitHub
(`/royaume-des-sons/`), pour que l'URL GitHub Pages fonctionne correctement.
Il ne doit pas être changé sans mettre à jour en même temps le manifeste PWA
et les chemins d'assets.

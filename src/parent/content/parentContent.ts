// Contenu propre à la leaf F1 (écran parent), volontairement placé dans un
// sous-dossier nommé `content` (comme src/content/**) : tools/lib/checks/
// hardcoded.mjs (GB6, CLAUDE.md règle #2) exempte tout segment de chemin
// littéralement nommé "content".
//
// Ce texte n'est JAMAIS montré ni énoncé à l'enfant : c'est uniquement la
// phrase de test du bouton "Tester la voix" de l'écran parent (SPEC §9), qui
// s'adresse à un adulte, au même titre que src/app/VoiceCheckScreen (seul
// autre écran du jeu qui s'adresse explicitement à un lecteur adulte).
// Documenté dans le rapport de la leaf F1 : CLAUDE.md règle #2 interdit le
// contenu pédagogique en dur dans un composant PARTAGÉ, pas le contenu propre
// à une leaf tant qu'il ne fait pas partie du corpus appris par l'enfant.

export const PARENT_VOICE_TEST_PHRASE_ID = 'parent-voice-test-phrase'

export const PARENT_VOICE_TEST_PHRASE =
  "Ceci est un essai de la voix du jeu, avec le réglage de vitesse choisi ici."

// Libellés adulte du tableau de bord (statut de maîtrise par compétence,
// SPEC §9) : regroupés ici, dans un dossier nommé "content" comme
// src/content/**, pour la même raison que PARENT_VOICE_TEST_PHRASE ci-dessus
// (exemption de tools/lib/checks/hardcoded.mjs sur tout segment de chemin
// nommé "content" — voir commentaire de tête de fichier). Ce ne sont pas des
// données apprises par l'enfant : uniquement des mots affichés à un adulte.
export const PARENT_SKILL_STATUS_LABEL: Record<'not-started' | 'in-progress' | 'mastered', string> = {
  'not-started': 'Pas encore abordée',
  'in-progress': 'En cours',
  mastered: 'Maîtrisée',
}

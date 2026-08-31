// Point de montage réel du jeu (leaf A5, intégration racine). Le squelette
// de démarrage Vite (compteur, logos Vite/React) a été entièrement retiré :
// voir src/app/root/GameRoot.tsx pour la composition complète.
import { GameRoot } from './app/root/GameRoot'

export default function App() {
  return <GameRoot />
}

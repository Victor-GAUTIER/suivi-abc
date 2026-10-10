import type { Sauvegarde } from '../types'

// Un stockage distant est un simple fichier texte (ici : le fichier chiffré de la synchro).
export interface StockageDistant {
  // Renvoie le contenu du fichier distant, ou null s'il n'existe pas encore.
  lire: () => Promise<string | null>
  ecrire: (contenu: string) => Promise<void>
}

// Le dépôt local expose uniquement ce dont le moteur de synchro a besoin.
export interface DepotLocal {
  lireSauvegarde: () => Promise<Sauvegarde>
  // Écrit seulement les éléments nouveaux ou plus récents. Renvoie le nombre d'éléments modifiés.
  appliquerSauvegarde: (sauvegarde: Sauvegarde) => Promise<number>
}

export interface ResultatSynchro {
  elementsRecus: number
  envoye: boolean
  termineLe: string
}

export class ErreurMotDePasse extends Error {}

export class ErreurAuthentificationGoogle extends Error {}

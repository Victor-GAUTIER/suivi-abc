// Fichier reconstruit à partir de l'usage dans le reste du code (l'original a été écrasé par erreur).
// Chaque élément synchronisable porte un identifiant unique et une date de modification.
// La suppression est logique (champ `supprime`) pour se propager d'un appareil à l'autre.

export interface ElementSynchronisable {
  id: string
  modifieLe: string
}

export interface Profil extends ElementSynchronisable {
  code: string
  supprime: boolean
}

export interface TypeComportement extends ElementSynchronisable {
  nom: string
  couleur: string
  supprime: boolean
}

export type FonctionHypothetique = 'attention' | 'evitement' | 'acces_objet' | 'sensoriel'

export const LIBELLES_FONCTIONS: Record<FonctionHypothetique, string> = {
  attention: 'Attention',
  evitement: 'Évitement',
  acces_objet: 'Accès à un objet ou une activité',
  sensoriel: 'Sensoriel',
}

export interface EntreeABC extends ElementSynchronisable {
  profilId: string
  dateHeure: string
  typeId: string
  antecedents: string
  comportement: string
  consequences: string
  lieu: string
  personnesPresentes: string[]
  intensite: number | null
  dureeMinutes: number | null
  fonctionHypothetique: FonctionHypothetique | null
  auteur: string
  supprime: boolean
}

export interface Sauvegarde {
  version: 1
  exporteLe: string
  profils: Profil[]
  typesComportement: TypeComportement[]
  entrees: EntreeABC[]
}

export interface EnveloppeChiffree {
  version: 1
  chiffre: true
  sel: string
  vecteurInitialisation: string
  donnees: string
}

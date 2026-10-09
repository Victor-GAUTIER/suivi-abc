// Fichier reconstruit à partir de l'usage dans depot.ts et App.tsx (l'original a été écrasé par erreur).
import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { EntreeABC, Profil, TypeComportement } from './types'

export interface Parametre {
  cle: string
  valeur: string
}

class BaseSuiviABC extends Dexie {
  profils!: Table<Profil, string>
  typesComportement!: Table<TypeComportement, string>
  entrees!: Table<EntreeABC, string>
  parametres!: Table<Parametre, string>

  constructor() {
    super('suivi-abc')
    this.version(1).stores({
      profils: 'id',
      typesComportement: 'id',
      entrees: 'id, profilId, dateHeure',
      parametres: 'cle',
    })
  }
}

export const baseSuiviABC = new BaseSuiviABC()

import { baseSuiviABC } from '../db'
import { maintenantHorodatage } from '../dates'
import { elementsAEcrire } from '../fusion'
import type { Sauvegarde } from '../types'
import type { DepotLocal } from './types'

// Pendant que la synchro écrit dans la base, on ne veut pas que ces écritures
// déclenchent une nouvelle synchro (sinon : boucle sans fin).
let ecritureParSynchroEnCours = false

export const depotLocalDexie: DepotLocal = {
  async lireSauvegarde(): Promise<Sauvegarde> {
    const [profils, typesComportement, entrees] = await Promise.all([
      baseSuiviABC.profils.toArray(),
      baseSuiviABC.typesComportement.toArray(),
      baseSuiviABC.entrees.toArray(),
    ])
    return { version: 1, exporteLe: maintenantHorodatage(), profils, typesComportement, entrees }
  },

  async appliquerSauvegarde(sauvegarde: Sauvegarde): Promise<number> {
    ecritureParSynchroEnCours = true
    try {
      return await baseSuiviABC.transaction(
        'rw',
        [baseSuiviABC.profils, baseSuiviABC.typesComportement, baseSuiviABC.entrees],
        async () => {
          const profilsAEcrire = elementsAEcrire(
            await baseSuiviABC.profils.toArray(),
            sauvegarde.profils,
          )
          const typesAEcrire = elementsAEcrire(
            await baseSuiviABC.typesComportement.toArray(),
            sauvegarde.typesComportement,
          )
          const entreesAEcrire = elementsAEcrire(
            await baseSuiviABC.entrees.toArray(),
            sauvegarde.entrees,
          )
          if (profilsAEcrire.length > 0) {
            await baseSuiviABC.profils.bulkPut(profilsAEcrire)
          }
          if (typesAEcrire.length > 0) {
            await baseSuiviABC.typesComportement.bulkPut(typesAEcrire)
          }
          if (entreesAEcrire.length > 0) {
            await baseSuiviABC.entrees.bulkPut(entreesAEcrire)
          }
          return profilsAEcrire.length + typesAEcrire.length + entreesAEcrire.length
        },
      )
    } finally {
      ecritureParSynchroEnCours = false
    }
  },
}

// Prévient quand l'utilisateur modifie ses données (profils, types, entrées).
// Les écritures faites par la synchro elle-même sont ignorées.
export function ecouterModificationsLocales(rappel: () => void): void {
  const gestionnaire = () => {
    if (!ecritureParSynchroEnCours) {
      rappel()
    }
  }
  for (const table of [baseSuiviABC.profils, baseSuiviABC.typesComportement, baseSuiviABC.entrees]) {
    table.hook('creating', gestionnaire)
    table.hook('updating', gestionnaire)
    table.hook('deleting', gestionnaire)
  }
}

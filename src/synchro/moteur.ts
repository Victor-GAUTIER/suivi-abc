import { maintenantHorodatage } from '../dates'
import { elementsAEcrire } from '../fusion'
import { lireContenuFichier } from '../sauvegarde'
import type { Sauvegarde } from '../types'
import type { DepotLocal, ResultatSynchro, StockageDistant } from './types'

// Les fichiers de synchro sont du JSON lisible (non chiffré). Un fichier chiffré est un reste
// d'une ancienne version de l'application : il n'est plus utilisé.
export function lireSauvegardeDistante(contenuDistant: string): Sauvegarde {
  const contenuLu = lireContenuFichier(contenuDistant)
  if (contenuLu.type === 'chiffre') {
    throw new Error(
      "Ce fichier a été créé par une ancienne version de l'application (il est chiffré) : il n'est plus utilisé.",
    )
  }
  return contenuLu.sauvegarde
}

// Le fichier distant n'a rien à gagner si aucun élément local n'est nouveau ou plus récent.
function distantEstDejaAJour(sauvegardeLocale: Sauvegarde, sauvegardeDistante: Sauvegarde): boolean {
  return (
    elementsAEcrire(sauvegardeDistante.profils, sauvegardeLocale.profils).length === 0 &&
    elementsAEcrire(sauvegardeDistante.typesComportement, sauvegardeLocale.typesComportement).length === 0 &&
    elementsAEcrire(sauvegardeDistante.entrees, sauvegardeLocale.entrees).length === 0
  )
}

// Synchronisation en trois temps :
// 1. lire le fichier distant et le fusionner dans les données locales ;
// 2. relire les données locales fusionnées ;
// 3. renvoyer le fichier distant seulement s'il manque quelque chose.
// Chaque appareil garde toutes ses données : si deux appareils écrivent en même temps,
// la synchro suivante de chacun rétablit l'union des deux.
export async function synchroniser(
  stockage: StockageDistant,
  depotLocal: DepotLocal,
): Promise<ResultatSynchro> {
  const contenuDistant = await stockage.lire()
  const sauvegardeDistante = contenuDistant === null ? null : lireSauvegardeDistante(contenuDistant)

  const elementsRecus =
    sauvegardeDistante === null ? 0 : await depotLocal.appliquerSauvegarde(sauvegardeDistante)

  const sauvegardeLocale = await depotLocal.lireSauvegarde()
  const doitEnvoyer =
    sauvegardeDistante === null || !distantEstDejaAJour(sauvegardeLocale, sauvegardeDistante)

  if (doitEnvoyer) {
    await stockage.ecrire(JSON.stringify(sauvegardeLocale))
  }

  return { elementsRecus, envoye: doitEnvoyer, termineLe: maintenantHorodatage() }
}

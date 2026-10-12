import { maintenantHorodatage } from '../dates'
import { elementsAEcrire } from '../fusion'
import { dechiffrerSauvegarde, lireContenuFichier, serialiserSauvegarde } from '../sauvegarde'
import type { Sauvegarde } from '../types'
import { ErreurMotDePasse } from './types'
import type { DepotLocal, ResultatSynchro, StockageDistant } from './types'

export async function lireSauvegardeDistante(
  contenuDistant: string,
  motDePasse: string,
): Promise<Sauvegarde> {
  const contenuLu = lireContenuFichier(contenuDistant)
  if (contenuLu.type === 'clair') {
    return contenuLu.sauvegarde
  }
  try {
    return await dechiffrerSauvegarde(contenuLu.enveloppe, motDePasse)
  } catch (erreur) {
    const messageOriginal = erreur instanceof Error ? erreur.message : ''
    throw new ErreurMotDePasse(
      messageOriginal === '' ? 'Mot de passe incorrect ou fichier corrompu.' : messageOriginal,
    )
  }
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
  motDePasse: string,
): Promise<ResultatSynchro> {
  if (motDePasse === '') {
    throw new ErreurMotDePasse('Un mot de passe de chiffrement est nécessaire pour synchroniser.')
  }

  const contenuDistant = await stockage.lire()
  const sauvegardeDistante =
    contenuDistant === null ? null : await lireSauvegardeDistante(contenuDistant, motDePasse)

  const elementsRecus =
    sauvegardeDistante === null ? 0 : await depotLocal.appliquerSauvegarde(sauvegardeDistante)

  const sauvegardeLocale = await depotLocal.lireSauvegarde()
  const doitEnvoyer =
    sauvegardeDistante === null || !distantEstDejaAJour(sauvegardeLocale, sauvegardeDistante)

  if (doitEnvoyer) {
    const contenuChiffre = await serialiserSauvegarde(sauvegardeLocale, motDePasse)
    await stockage.ecrire(contenuChiffre)
  }

  return { elementsRecus, envoye: doitEnvoyer, termineLe: maintenantHorodatage() }
}

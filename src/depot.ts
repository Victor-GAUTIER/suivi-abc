import { baseSuiviABC } from './db'
import { maintenantHorodatage } from './dates'
import { trouverElementDeMemeNom } from './doublons'
import { fusionnerParIdentifiant } from './fusion'
import type { EntreeABC, Profil, Sauvegarde, TypeComportement } from './types'

const CLE_TYPES_INITIALISES = 'typesInitialises'
const CLE_AUTEUR = 'auteur'
const CLE_PROFIL_ACTIF = 'profilActif'

// Date très ancienne : toute modification ou suppression faite ensuite sur un appareil
// sera plus récente et l'emportera lors de la fusion.
const DATE_TYPES_PAR_DEFAUT = '1970-01-01T00:00:00.000Z'

// Identifiants fixes : deux appareils qui créent ces types par défaut
// ne produisent pas de doublons au moment de la synchro.
const TYPES_PAR_DEFAUT: Array<Pick<TypeComportement, 'id' | 'nom' | 'couleur'>> = [
  { id: 'type-defaut-agitation', nom: 'Agitation', couleur: '#3b82f6' },
  { id: 'type-defaut-opposition', nom: 'Opposition', couleur: '#f59e0b' },
  { id: 'type-defaut-crise', nom: 'Crise', couleur: '#ef4444' },
  { id: 'type-defaut-comportement-repetitif', nom: 'Comportement répétitif', couleur: '#10b981' },
]

export async function lireParametre(cle: string): Promise<string | undefined> {
  const parametre = await baseSuiviABC.parametres.get(cle)
  return parametre?.valeur
}

export async function ecrireParametre(cle: string, valeur: string): Promise<void> {
  await baseSuiviABC.parametres.put({ cle, valeur })
}

export const parametresConnus = {
  auteur: CLE_AUTEUR,
  profilActif: CLE_PROFIL_ACTIF,
}

export async function initialiserTypesParDefaut(): Promise<void> {
  const dejaInitialises = await lireParametre(CLE_TYPES_INITIALISES)
  if (dejaInitialises === 'oui') {
    return
  }
  const nombreTypesExistants = await baseSuiviABC.typesComportement.count()
  if (nombreTypesExistants === 0) {
    const typesAAjouter: TypeComportement[] = TYPES_PAR_DEFAUT.map((typeParDefaut) => ({
      id: typeParDefaut.id,
      nom: typeParDefaut.nom,
      couleur: typeParDefaut.couleur,
      modifieLe: DATE_TYPES_PAR_DEFAUT,
      supprime: false,
    }))
    await baseSuiviABC.typesComportement.bulkPut(typesAAjouter)
  }
  await ecrireParametre(CLE_TYPES_INITIALISES, 'oui')
}

// Si un profil de même code existe déjà (par exemple reçu d'un autre appareil), on le réutilise
// au lieu d'en créer un second : sinon la synchro afficherait deux profils identiques.
export async function creerProfil(code: string): Promise<Profil> {
  const codeNettoye = code.trim()
  const profilsExistants = await baseSuiviABC.profils.toArray()
  const profilDejaPresent = trouverElementDeMemeNom(
    profilsExistants,
    codeNettoye,
    (profil) => profil.code,
  )
  if (profilDejaPresent !== undefined) {
    if (!profilDejaPresent.supprime) {
      return profilDejaPresent
    }
    const profilRestaure: Profil = {
      ...profilDejaPresent,
      supprime: false,
      modifieLe: maintenantHorodatage(),
    }
    await baseSuiviABC.profils.put(profilRestaure)
    return profilRestaure
  }
  const nouveauProfil: Profil = {
    id: crypto.randomUUID(),
    code: codeNettoye,
    modifieLe: maintenantHorodatage(),
    supprime: false,
  }
  await baseSuiviABC.profils.add(nouveauProfil)
  return nouveauProfil
}

export async function renommerProfil(identifiant: string, nouveauCode: string): Promise<void> {
  await baseSuiviABC.profils.update(identifiant, {
    code: nouveauCode.trim(),
    modifieLe: maintenantHorodatage(),
  })
}

export async function supprimerProfil(identifiant: string): Promise<void> {
  await baseSuiviABC.profils.update(identifiant, {
    supprime: true,
    modifieLe: maintenantHorodatage(),
  })
}

// Même principe que pour les profils : un type de même nom est réutilisé (et restauré s'il
// avait été supprimé) plutôt que dupliqué.
export async function creerType(nom: string, couleur: string): Promise<void> {
  const nomNettoye = nom.trim()
  const typesExistants = await baseSuiviABC.typesComportement.toArray()
  const typeDejaPresent = trouverElementDeMemeNom(typesExistants, nomNettoye, (type) => type.nom)
  if (typeDejaPresent !== undefined) {
    if (typeDejaPresent.supprime) {
      await baseSuiviABC.typesComportement.put({
        ...typeDejaPresent,
        supprime: false,
        couleur,
        modifieLe: maintenantHorodatage(),
      })
    }
    return
  }
  const nouveauType: TypeComportement = {
    id: crypto.randomUUID(),
    nom: nomNettoye,
    couleur,
    modifieLe: maintenantHorodatage(),
    supprime: false,
  }
  await baseSuiviABC.typesComportement.add(nouveauType)
}

export async function modifierType(
  identifiant: string,
  modifications: Partial<Pick<TypeComportement, 'nom' | 'couleur'>>,
): Promise<void> {
  await baseSuiviABC.typesComportement.update(identifiant, {
    ...modifications,
    modifieLe: maintenantHorodatage(),
  })
}

export async function supprimerType(identifiant: string): Promise<void> {
  await baseSuiviABC.typesComportement.update(identifiant, {
    supprime: true,
    modifieLe: maintenantHorodatage(),
  })
}

export type DonneesSaisieEntree = Omit<EntreeABC, 'id' | 'modifieLe' | 'supprime'>

export async function creerEntree(donneesSaisie: DonneesSaisieEntree): Promise<void> {
  const nouvelleEntree: EntreeABC = {
    ...donneesSaisie,
    id: crypto.randomUUID(),
    modifieLe: maintenantHorodatage(),
    supprime: false,
  }
  await baseSuiviABC.entrees.add(nouvelleEntree)
}

export async function modifierEntree(
  identifiant: string,
  donneesSaisie: DonneesSaisieEntree,
): Promise<void> {
  await baseSuiviABC.entrees.update(identifiant, {
    ...donneesSaisie,
    modifieLe: maintenantHorodatage(),
  })
}

export async function supprimerEntree(identifiant: string): Promise<void> {
  await baseSuiviABC.entrees.update(identifiant, {
    supprime: true,
    modifieLe: maintenantHorodatage(),
  })
}

export async function construireSauvegarde(): Promise<Sauvegarde> {
  const [profils, typesComportement, entrees] = await Promise.all([
    baseSuiviABC.profils.toArray(),
    baseSuiviABC.typesComportement.toArray(),
    baseSuiviABC.entrees.toArray(),
  ])
  return {
    version: 1,
    exporteLe: maintenantHorodatage(),
    profils,
    typesComportement,
    entrees,
  }
}

export interface ResumeImport {
  profils: number
  typesComportement: number
  entrees: number
}

export async function importerSauvegarde(sauvegarde: Sauvegarde): Promise<ResumeImport> {
  const [profilsLocaux, typesLocaux, entreesLocales] = await Promise.all([
    baseSuiviABC.profils.toArray(),
    baseSuiviABC.typesComportement.toArray(),
    baseSuiviABC.entrees.toArray(),
  ])
  const profilsFusionnes = fusionnerParIdentifiant(profilsLocaux, sauvegarde.profils)
  const typesFusionnes = fusionnerParIdentifiant(typesLocaux, sauvegarde.typesComportement)
  const entreesFusionnees = fusionnerParIdentifiant(entreesLocales, sauvegarde.entrees)
  await baseSuiviABC.transaction(
    'rw',
    [baseSuiviABC.profils, baseSuiviABC.typesComportement, baseSuiviABC.entrees],
    async () => {
      await baseSuiviABC.profils.bulkPut(profilsFusionnes)
      await baseSuiviABC.typesComportement.bulkPut(typesFusionnes)
      await baseSuiviABC.entrees.bulkPut(entreesFusionnees)
    },
  )
  return {
    profils: profilsFusionnes.length - profilsLocaux.length,
    typesComportement: typesFusionnes.length - typesLocaux.length,
    entrees: entreesFusionnees.length - entreesLocales.length,
  }
}

export async function effacerToutesLesDonnees(): Promise<void> {
  await baseSuiviABC.transaction(
    'rw',
    [
      baseSuiviABC.profils,
      baseSuiviABC.typesComportement,
      baseSuiviABC.entrees,
      baseSuiviABC.parametres,
    ],
    async () => {
      await baseSuiviABC.profils.clear()
      await baseSuiviABC.typesComportement.clear()
      await baseSuiviABC.entrees.clear()
      await baseSuiviABC.parametres.clear()
    },
  )
}

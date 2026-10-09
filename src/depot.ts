import { baseSuiviABC } from './db'
import { maintenantHorodatage } from './dates'
import { fusionnerParIdentifiant } from './fusion'
import type { EntreeABC, Profil, Sauvegarde, TypeComportement } from './types'

const CLE_TYPES_INITIALISES = 'typesInitialises'
const CLE_AUTEUR = 'auteur'
const CLE_PROFIL_ACTIF = 'profilActif'

const TYPES_PAR_DEFAUT: Array<Pick<TypeComportement, 'nom' | 'couleur'>> = [
  { nom: 'Agitation', couleur: '#3b82f6' },
  { nom: 'Opposition', couleur: '#f59e0b' },
  { nom: 'Crise', couleur: '#ef4444' },
  { nom: 'Comportement répétitif', couleur: '#10b981' },
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
    const horodatage = maintenantHorodatage()
    const typesAAjouter: TypeComportement[] = TYPES_PAR_DEFAUT.map((typeParDefaut) => ({
      id: crypto.randomUUID(),
      nom: typeParDefaut.nom,
      couleur: typeParDefaut.couleur,
      modifieLe: horodatage,
      supprime: false,
    }))
    await baseSuiviABC.typesComportement.bulkAdd(typesAAjouter)
  }
  await ecrireParametre(CLE_TYPES_INITIALISES, 'oui')
}

export async function creerProfil(code: string): Promise<Profil> {
  const nouveauProfil: Profil = {
    id: crypto.randomUUID(),
    code: code.trim(),
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

export async function creerType(nom: string, couleur: string): Promise<void> {
  const nouveauType: TypeComportement = {
    id: crypto.randomUUID(),
    nom: nom.trim(),
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

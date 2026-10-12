import { ecrireParametre, lireParametre } from '../depot'
import { maintenantHorodatage } from '../dates'
import { serialiserSauvegarde } from '../sauvegarde'
import { creerDepotLocalPourProfil, ecouterModificationsLocales } from '../synchro/depotLocal'
import { obtenirJetonGoogle, oublierJetonGoogle, synchroGoogleEstConfiguree } from '../synchro/googleAuth'
import { creerFichierDrive, StockageFichierDrive } from '../synchro/googleDrive'
import { lireSauvegardeDistante, synchroniser } from '../synchro/moteur'
import {
  ErreurAccesFichierDrive,
  ErreurAuthentificationGoogle,
  ErreurMotDePasse,
} from '../synchro/types'
import {
  inviterPersonne,
  listerPersonnesAvecAcces,
  lireDroitsSurFichier,
  retirerAcces,
} from './permissions'
import type { DroitsSurFichier, PersonneAvecAcces, RolePartage } from './permissions'
import { choisirFichierDrive } from './selecteurGoogle'

const CLE_CONFIGURATIONS_PARTAGE = 'partageProfils'

const DELAI_APRES_MODIFICATION_MS = 4_000
const DELAI_ENTRE_SYNCHROS_PERIODIQUES_MS = 5 * 60_000
const DELAI_MINIMAL_RETOUR_ONGLET_MS = 30_000

// Les réglages du partage restent sur l'appareil (le mot de passe aussi, comme pour la synchro).
export interface ConfigurationPartage {
  profilId: string
  identifiantFichier: string
  motDePasse: string
}

export type StatutPartageProfil = 'repos' | 'en_cours' | 'reconnexion_necessaire' | 'erreur'

export interface EtatPartageProfil {
  statut: StatutPartageProfil
  messageErreur: string
  derniereSynchroLe: string | null
}

export interface EtatPartage {
  configurations: ConfigurationPartage[]
  parProfil: Record<string, EtatPartageProfil>
}

let etatCourant: EtatPartage = { configurations: [], parProfil: {} }
const ecouteursEtat = new Set<() => void>()

function changerEtat(nouvelEtat: EtatPartage): void {
  etatCourant = nouvelEtat
  ecouteursEtat.forEach((ecouteur) => ecouteur())
}

function changerEtatProfil(profilId: string, modifications: Partial<EtatPartageProfil>): void {
  const etatPrecedent: EtatPartageProfil = etatCourant.parProfil[profilId] ?? {
    statut: 'repos',
    messageErreur: '',
    derniereSynchroLe: null,
  }
  changerEtat({
    ...etatCourant,
    parProfil: { ...etatCourant.parProfil, [profilId]: { ...etatPrecedent, ...modifications } },
  })
}

export function lireEtatPartage(): EtatPartage {
  return etatCourant
}

export function abonnerEtatPartage(ecouteur: () => void): () => void {
  ecouteursEtat.add(ecouteur)
  return () => {
    ecouteursEtat.delete(ecouteur)
  }
}

export function trouverConfigurationPartage(profilId: string): ConfigurationPartage | undefined {
  return etatCourant.configurations.find((configuration) => configuration.profilId === profilId)
}

async function enregistrerConfigurations(configurations: ConfigurationPartage[]): Promise<void> {
  await ecrireParametre(CLE_CONFIGURATIONS_PARTAGE, JSON.stringify(configurations))
  changerEtat({ ...etatCourant, configurations })
}

function lireConfigurationsEnregistrees(texte: string | undefined): ConfigurationPartage[] {
  if (texte === undefined || texte === '') {
    return []
  }
  try {
    const valeur = JSON.parse(texte) as unknown
    return Array.isArray(valeur) ? (valeur as ConfigurationPartage[]) : []
  } catch {
    return []
  }
}

function messageErreurLisible(erreur: unknown): string {
  if (!navigator.onLine) {
    return 'Hors ligne : la synchronisation reprendra au retour du réseau.'
  }
  return erreur instanceof Error ? erreur.message : 'La synchronisation a échoué.'
}

// ---------- Synchronisation des profils partagés ----------

let synchroEnCours: Promise<void> | null = null
let modificationPendantSynchro = false
let minuteurApresModification: ReturnType<typeof setTimeout> | null = null
let derniereTentativeLe = 0
let declencheursInstalles = false
let initialisationFaite = false

async function synchroniserUnProfil(
  configuration: ConfigurationPartage,
  interactif: boolean,
): Promise<void> {
  changerEtatProfil(configuration.profilId, { statut: 'en_cours', messageErreur: '' })
  try {
    const stockage = new StockageFichierDrive(configuration.identifiantFichier, () =>
      obtenirJetonGoogle(interactif),
    )
    const resultat = await synchroniser(
      stockage,
      creerDepotLocalPourProfil(configuration.profilId),
      configuration.motDePasse,
    )
    changerEtatProfil(configuration.profilId, {
      statut: 'repos',
      messageErreur: '',
      derniereSynchroLe: resultat.termineLe,
    })
  } catch (erreur) {
    if (erreur instanceof ErreurAuthentificationGoogle) {
      oublierJetonGoogle()
      changerEtatProfil(configuration.profilId, { statut: 'reconnexion_necessaire', messageErreur: '' })
      throw erreur
    }
    const message =
      erreur instanceof ErreurMotDePasse || erreur instanceof ErreurAccesFichierDrive
        ? erreur.message
        : messageErreurLisible(erreur)
    changerEtatProfil(configuration.profilId, { statut: 'erreur', messageErreur: message })
  }
}

async function executerSynchroPartages(interactif: boolean): Promise<void> {
  if (synchroEnCours !== null) {
    return synchroEnCours
  }
  synchroEnCours = (async () => {
    derniereTentativeLe = Date.now()
    for (const configuration of etatCourant.configurations) {
      try {
        await synchroniserUnProfil(configuration, interactif)
      } catch {
        // La connexion Google a expiré : inutile d'essayer les autres profils.
        for (const autre of etatCourant.configurations) {
          changerEtatProfil(autre.profilId, { statut: 'reconnexion_necessaire', messageErreur: '' })
        }
        break
      }
    }
  })()
  await synchroEnCours
  synchroEnCours = null
  if (modificationPendantSynchro) {
    modificationPendantSynchro = false
    planifierSynchroApresModification()
  }
}

export async function synchroniserProfilsPartages(interactif: boolean): Promise<void> {
  if (etatCourant.configurations.length === 0) {
    return
  }
  await executerSynchroPartages(interactif)
}

function toutNecessiteUneReconnexion(): boolean {
  return (
    etatCourant.configurations.length > 0 &&
    etatCourant.configurations.every(
      (configuration) => etatCourant.parProfil[configuration.profilId]?.statut === 'reconnexion_necessaire',
    )
  )
}

function planifierSynchroApresModification(): void {
  if (etatCourant.configurations.length === 0) {
    return
  }
  if (minuteurApresModification !== null) {
    clearTimeout(minuteurApresModification)
  }
  minuteurApresModification = setTimeout(() => {
    minuteurApresModification = null
    if (!toutNecessiteUneReconnexion()) {
      void synchroniserProfilsPartages(false)
    }
  }, DELAI_APRES_MODIFICATION_MS)
}

function installerDeclencheurs(): void {
  if (declencheursInstalles) {
    return
  }
  declencheursInstalles = true

  ecouterModificationsLocales(() => {
    if (synchroEnCours !== null) {
      modificationPendantSynchro = true
      return
    }
    planifierSynchroApresModification()
  })

  document.addEventListener('visibilitychange', () => {
    const delaiEcoule = Date.now() - derniereTentativeLe > DELAI_MINIMAL_RETOUR_ONGLET_MS
    if (document.visibilityState === 'visible' && delaiEcoule) {
      void synchroniserProfilsPartages(false)
    }
  })

  window.addEventListener('online', () => {
    void synchroniserProfilsPartages(false)
  })

  setInterval(() => {
    if (!toutNecessiteUneReconnexion()) {
      void synchroniserProfilsPartages(false)
    }
  }, DELAI_ENTRE_SYNCHROS_PERIODIQUES_MS)
}

// À appeler une fois au démarrage de l'application.
export async function initialiserPartage(): Promise<void> {
  if (initialisationFaite || !synchroGoogleEstConfiguree()) {
    return
  }
  initialisationFaite = true
  const configurations = lireConfigurationsEnregistrees(
    await lireParametre(CLE_CONFIGURATIONS_PARTAGE),
  )
  changerEtat({ ...etatCourant, configurations })
  if (configurations.length > 0) {
    installerDeclencheurs()
    void synchroniserProfilsPartages(false)
  }
}

// ---------- Actions déclenchées par l'utilisateur (depuis un clic) ----------

// Crée le fichier du profil dans « Mon Drive » (chiffré) et active sa synchro.
export async function activerPartage(
  profilId: string,
  codeProfil: string,
  motDePasse: string,
): Promise<void> {
  if (trouverConfigurationPartage(profilId) !== undefined) {
    throw new Error('Le partage est déjà activé pour ce profil.')
  }
  const jeton = () => obtenirJetonGoogle(true)
  await jeton()
  const depot = creerDepotLocalPourProfil(profilId)
  const contenu = await serialiserSauvegarde(await depot.lireSauvegarde(), motDePasse)
  const identifiantFichier = await creerFichierDrive(`Suivi ABC - profil ${codeProfil}.json`, contenu, jeton)
  await enregistrerConfigurations([
    ...etatCourant.configurations,
    { profilId, identifiantFichier, motDePasse },
  ])
  changerEtatProfil(profilId, {
    statut: 'repos',
    messageErreur: '',
    derniereSynchroLe: maintenantHorodatage(),
  })
  installerDeclencheurs()
}

// Choisit un fichier de profil dans Drive (sélecteur Google), le déchiffre et l'ajoute à l'appareil.
// Renvoie l'identifiant du profil ajouté, ou null si l'utilisateur a fermé le sélecteur.
export async function rejoindrePartage(motDePasse: string): Promise<string | null> {
  const jeton = () => obtenirJetonGoogle(true)
  const fichier = await choisirFichierDrive(await jeton())
  if (fichier === null) {
    return null
  }
  const stockage = new StockageFichierDrive(fichier.identifiant, jeton)
  const contenu = await stockage.lire()
  if (contenu === null) {
    throw new Error("Ce fichier est vide : ce n'est pas un profil de Suivi ABC.")
  }
  const sauvegarde = await lireSauvegardeDistante(contenu, motDePasse)
  if (sauvegarde.profils.length !== 1) {
    throw new Error("Ce fichier n'est pas un profil partagé de Suivi ABC.")
  }
  const profilId = sauvegarde.profils[0].id
  if (trouverConfigurationPartage(profilId) !== undefined) {
    throw new Error('Ce profil est déjà synchronisé sur cet appareil.')
  }
  await creerDepotLocalPourProfil(profilId).appliquerSauvegarde(sauvegarde)
  await enregistrerConfigurations([
    ...etatCourant.configurations,
    { profilId, identifiantFichier: fichier.identifiant, motDePasse },
  ])
  installerDeclencheurs()
  await synchroniserProfilsPartages(true)
  return profilId
}

// Les données restent sur l'appareil ; seul le lien avec le fichier partagé est coupé.
export async function arreterPartage(profilId: string): Promise<void> {
  const configurations = etatCourant.configurations.filter(
    (configuration) => configuration.profilId !== profilId,
  )
  const { [profilId]: _ignore, ...autresEtats } = etatCourant.parProfil
  await enregistrerConfigurations(configurations)
  changerEtat({ ...etatCourant, parProfil: autresEtats })
}

export async function synchroniserPartageMaintenant(): Promise<void> {
  await synchroniserProfilsPartages(true)
}

function configurationObligatoire(profilId: string): ConfigurationPartage {
  const configuration = trouverConfigurationPartage(profilId)
  if (configuration === undefined) {
    throw new Error("Le partage n'est pas activé pour ce profil.")
  }
  return configuration
}

export async function lireDroitsPartage(profilId: string): Promise<DroitsSurFichier> {
  const { identifiantFichier } = configurationObligatoire(profilId)
  return lireDroitsSurFichier(identifiantFichier, () => obtenirJetonGoogle(true))
}

export async function listerAccesPartage(profilId: string): Promise<PersonneAvecAcces[]> {
  const { identifiantFichier } = configurationObligatoire(profilId)
  return listerPersonnesAvecAcces(identifiantFichier, () => obtenirJetonGoogle(true))
}

export async function inviterAccesPartage(
  profilId: string,
  adresseEmail: string,
  role: RolePartage,
): Promise<void> {
  const { identifiantFichier } = configurationObligatoire(profilId)
  await inviterPersonne(identifiantFichier, adresseEmail, role, () => obtenirJetonGoogle(true))
}

export async function retirerAccesPartage(profilId: string, identifiantPermission: string): Promise<void> {
  const { identifiantFichier } = configurationObligatoire(profilId)
  await retirerAcces(identifiantFichier, identifiantPermission, () => obtenirJetonGoogle(true))
}

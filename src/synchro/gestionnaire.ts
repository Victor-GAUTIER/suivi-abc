import { ecrireParametre, lireParametre } from '../depot'
import { depotLocalDexie, ecouterModificationsLocales } from './depotLocal'
import {
  obtenirJetonGoogle,
  oublierJetonGoogle,
  prechargerBibliothequeGoogle,
  revoquerJetonGoogle,
  synchroGoogleEstConfiguree,
} from './googleAuth'
import { StockageGoogleDrive } from './googleDrive'
import { synchroniser } from './moteur'
import { ErreurAuthentificationGoogle, ErreurMotDePasse } from './types'

const CLE_SYNCHRO_ACTIVE = 'synchroGoogleActive'
const CLE_MOT_DE_PASSE = 'synchroGoogleMotDePasse'
const CLE_DERNIERE_SYNCHRO = 'synchroGoogleDerniereLe'

const DELAI_APRES_MODIFICATION_MS = 4_000
const DELAI_ENTRE_SYNCHROS_PERIODIQUES_MS = 5 * 60_000
const DELAI_MINIMAL_RETOUR_ONGLET_MS = 30_000

export type StatutSynchro = 'inactive' | 'repos' | 'en_cours' | 'reconnexion_necessaire' | 'erreur'

export interface EtatSynchro {
  statut: StatutSynchro
  messageErreur: string
  derniereSynchroLe: string | null
}

let etatCourant: EtatSynchro = { statut: 'inactive', messageErreur: '', derniereSynchroLe: null }
const ecouteursEtat = new Set<() => void>()

function changerEtat(modifications: Partial<EtatSynchro>): void {
  etatCourant = { ...etatCourant, ...modifications }
  ecouteursEtat.forEach((ecouteur) => ecouteur())
}

export function lireEtatSynchro(): EtatSynchro {
  return etatCourant
}

export function abonnerEtatSynchro(ecouteur: () => void): () => void {
  ecouteursEtat.add(ecouteur)
  return () => {
    ecouteursEtat.delete(ecouteur)
  }
}

let synchroActive = false
let motDePasseActif = ''
let synchroEnCours: Promise<boolean> | null = null
let modificationPendantSynchro = false
let minuteurApresModification: ReturnType<typeof setTimeout> | null = null
let derniereTentativeLe = 0
let declencheursInstalles = false
let initialisationFaite = false

function messageErreurLisible(erreur: unknown): string {
  if (!navigator.onLine) {
    return 'Hors ligne : la synchronisation reprendra au retour du réseau.'
  }
  return erreur instanceof Error ? erreur.message : 'La synchronisation a échoué.'
}

// Une seule synchro à la fois. Renvoie true si elle a réussi.
async function executerSynchro(interactif: boolean): Promise<boolean> {
  if (synchroEnCours !== null) {
    return synchroEnCours
  }
  synchroEnCours = (async () => {
    derniereTentativeLe = Date.now()
    changerEtat({ statut: 'en_cours', messageErreur: '' })
    try {
      const stockage = new StockageGoogleDrive(() => obtenirJetonGoogle(interactif))
      const resultat = await synchroniser(stockage, depotLocalDexie, motDePasseActif)
      await ecrireParametre(CLE_DERNIERE_SYNCHRO, resultat.termineLe)
      changerEtat({ statut: 'repos', messageErreur: '', derniereSynchroLe: resultat.termineLe })
      return true
    } catch (erreur) {
      if (erreur instanceof ErreurAuthentificationGoogle) {
        oublierJetonGoogle()
        // Le message est conservé : lors de la première connexion, c'est la seule trace de la cause.
        changerEtat({ statut: 'reconnexion_necessaire', messageErreur: erreur.message })
      } else if (erreur instanceof ErreurMotDePasse) {
        changerEtat({ statut: 'erreur', messageErreur: erreur.message })
      } else {
        changerEtat({ statut: 'erreur', messageErreur: messageErreurLisible(erreur) })
      }
      return false
    }
  })()
  const reussite = await synchroEnCours
  synchroEnCours = null
  if (modificationPendantSynchro) {
    modificationPendantSynchro = false
    planifierSynchroApresModification()
  }
  return reussite
}

export async function synchroniserMaintenant(interactif: boolean): Promise<boolean> {
  if (!synchroActive) {
    return false
  }
  return executerSynchro(interactif)
}

function planifierSynchroApresModification(): void {
  if (!synchroActive) {
    return
  }
  if (minuteurApresModification !== null) {
    clearTimeout(minuteurApresModification)
  }
  minuteurApresModification = setTimeout(() => {
    minuteurApresModification = null
    if (etatCourant.statut !== 'reconnexion_necessaire') {
      void synchroniserMaintenant(false)
    }
  }, DELAI_APRES_MODIFICATION_MS)
}

function signalerModificationLocale(): void {
  if (synchroEnCours !== null) {
    modificationPendantSynchro = true
    return
  }
  planifierSynchroApresModification()
}

function installerDeclencheurs(): void {
  if (declencheursInstalles) {
    return
  }
  declencheursInstalles = true

  ecouterModificationsLocales(signalerModificationLocale)

  document.addEventListener('visibilitychange', () => {
    const delaiEcoule = Date.now() - derniereTentativeLe > DELAI_MINIMAL_RETOUR_ONGLET_MS
    if (document.visibilityState === 'visible' && synchroActive && delaiEcoule) {
      void synchroniserMaintenant(false)
    }
  })

  window.addEventListener('online', () => {
    void synchroniserMaintenant(false)
  })

  setInterval(() => {
    if (synchroActive && etatCourant.statut !== 'reconnexion_necessaire') {
      void synchroniserMaintenant(false)
    }
  }, DELAI_ENTRE_SYNCHROS_PERIODIQUES_MS)
}

// À appeler une fois au démarrage de l'application.
export async function initialiserSynchro(): Promise<void> {
  if (initialisationFaite || !synchroGoogleEstConfiguree()) {
    return
  }
  initialisationFaite = true
  const [active, motDePasse, derniereSynchro] = await Promise.all([
    lireParametre(CLE_SYNCHRO_ACTIVE),
    lireParametre(CLE_MOT_DE_PASSE),
    lireParametre(CLE_DERNIERE_SYNCHRO),
  ])
  if (derniereSynchro !== undefined) {
    changerEtat({ derniereSynchroLe: derniereSynchro })
  }
  if (active === 'oui' && motDePasse !== undefined && motDePasse !== '') {
    prechargerBibliothequeGoogle()
    synchroActive = true
    motDePasseActif = motDePasse
    changerEtat({ statut: 'repos' })
    installerDeclencheurs()
    void synchroniserMaintenant(false)
  }
}

// Première connexion : doit être appelée depuis un clic (fenêtre de connexion Google).
export async function connecterGoogleDrive(motDePasse: string): Promise<boolean> {
  motDePasseActif = motDePasse
  const reussite = await executerSynchro(true)
  if (!reussite) {
    motDePasseActif = ''
    changerEtat({ statut: 'inactive' })
    return false
  }
  await ecrireParametre(CLE_SYNCHRO_ACTIVE, 'oui')
  await ecrireParametre(CLE_MOT_DE_PASSE, motDePasse)
  synchroActive = true
  installerDeclencheurs()
  return true
}

// Les données restent sur l'appareil ; seul le lien avec Google Drive est coupé.
export async function deconnecterGoogleDrive(): Promise<void> {
  synchroActive = false
  motDePasseActif = ''
  revoquerJetonGoogle()
  await ecrireParametre(CLE_SYNCHRO_ACTIVE, 'non')
  await ecrireParametre(CLE_MOT_DE_PASSE, '')
  changerEtat({ statut: 'inactive', messageErreur: '' })
}

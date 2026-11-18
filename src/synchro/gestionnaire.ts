import { baseSuiviABC } from '../db'
import { maintenantHorodatage } from '../dates'
import { ecrireParametre, lireParametre } from '../depot'
import { oublierInvitation } from '../partage/invitation'
import { choisirFichierDrive } from '../partage/selecteurGoogle'
import { creerDepotLocalPourProfil, ecouterModificationsLocales } from './depotLocal'
import {
  lireErreurRetourRedirection,
  obtenirJetonGoogle,
  oublierJetonGoogle,
  prechargerBibliothequeGoogle,
  revoquerJetonGoogle,
  synchroGoogleEstConfiguree,
  unJetonEstMemorise,
} from './googleAuth'
import {
  creerFichierDrive,
  listerFichiersProfils,
  PREFIXE_NOM_FICHIER_PROFIL,
  StockageFichierDrive,
} from './googleDrive'
import { lireSauvegardeDistante, synchroniser } from './moteur'
import {
  doitUtiliserRedirection,
  memoriserActionEnAttente,
  recupererActionEnAttente,
} from './redirectionGoogle'
import { ErreurAuthentificationGoogle } from './types'

// Une seule synchronisation pour tout : chaque profil est un fichier JSON dans le Google Drive de
// l'utilisateur (créé automatiquement). Les profils partagés avec lui en sont aussi.
// Un seul bouton : il se connecte à Google si besoin, retrouve les profils, crée les fichiers manquants
// et synchronise tout.

const CLE_CONNECTE = 'googleConnecte'
const CLE_CONFIGURATIONS = 'partageProfils'
const CLE_DERNIERE_SYNCHRO = 'synchroGoogleDerniereLe'

const DELAI_APRES_MODIFICATION_MS = 4_000
const DELAI_ENTRE_SYNCHROS_PERIODIQUES_MS = 5 * 60_000
const DELAI_MINIMAL_RETOUR_ONGLET_MS = 30_000

export interface ConfigurationProfil {
  profilId: string
  identifiantFichier: string
}

export type StatutSynchro = 'repos' | 'en_cours' | 'reconnexion_necessaire' | 'erreur'

export interface EtatSynchro {
  // Vrai dès que l'utilisateur s'est connecté à Google sur cet appareil.
  connecte: boolean
  statut: StatutSynchro
  messageErreur: string
  derniereSynchroLe: string | null
  configurations: ConfigurationProfil[]
  // Dernier profil ajouté en rejoignant une invitation : l'application s'ouvre dessus.
  profilRejointId: string
}

let etatCourant: EtatSynchro = {
  connecte: false,
  statut: 'repos',
  messageErreur: '',
  derniereSynchroLe: null,
  configurations: [],
  profilRejointId: '',
}
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

export function trouverConfigurationProfil(profilId: string): ConfigurationProfil | undefined {
  return etatCourant.configurations.find((configuration) => configuration.profilId === profilId)
}

async function enregistrerConfigurations(configurations: ConfigurationProfil[]): Promise<void> {
  await ecrireParametre(CLE_CONFIGURATIONS, JSON.stringify(configurations))
  changerEtat({ configurations })
}

// Les réglages d'une ancienne version contenaient un mot de passe : ces profils sont repris à zéro
// (un nouveau fichier lisible est créé), l'ancien fichier chiffré reste dans Drive sans servir.
function lireConfigurationsEnregistrees(texte: string | undefined): ConfigurationProfil[] {
  if (texte === undefined || texte === '') {
    return []
  }
  try {
    const valeur = JSON.parse(texte) as unknown
    if (!Array.isArray(valeur)) {
      return []
    }
    return (valeur as Array<Record<string, unknown>>)
      .filter(
        (element) =>
          typeof element.profilId === 'string' &&
          typeof element.identifiantFichier === 'string' &&
          element.motDePasse === undefined,
      )
      .map((element) => ({
        profilId: element.profilId as string,
        identifiantFichier: element.identifiantFichier as string,
      }))
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

let synchroEnCours: Promise<boolean> | null = null
let modificationPendantSynchro = false
let minuteurApresModification: ReturnType<typeof setTimeout> | null = null
let derniereTentativeLe = 0
let declencheursInstalles = false
let initialisationFaite = false

// Retrouve dans Drive les profils inconnus de cet appareil (autre appareil, profil partagé déjà choisi).
async function retrouverProfilsDansDrive(obtenirJeton: () => Promise<string>): Promise<void> {
  const fichiers = await listerFichiersProfils(obtenirJeton)
  for (const fichier of fichiers) {
    if (etatCourant.configurations.some((c) => c.identifiantFichier === fichier.identifiant)) {
      continue
    }
    try {
      const contenu = await new StockageFichierDrive(fichier.identifiant, obtenirJeton).lire()
      if (contenu === null) {
        continue
      }
      const sauvegarde = lireSauvegardeDistante(contenu)
      const profilId = sauvegarde.profils[0]?.id
      if (sauvegarde.profils.length !== 1 || profilId === undefined || trouverConfigurationProfil(profilId)) {
        continue
      }
      await creerDepotLocalPourProfil(profilId).appliquerSauvegarde(sauvegarde)
      await enregistrerConfigurations([
        ...etatCourant.configurations,
        { profilId, identifiantFichier: fichier.identifiant },
      ])
    } catch (erreur) {
      if (erreur instanceof ErreurAuthentificationGoogle) {
        throw erreur
      }
      // Fichier illisible ou ancien (chiffré) : on l'ignore, il ne concerne pas cette version.
    }
  }
}

// Crée dans Drive le fichier des profils locaux qui n'en ont pas encore.
async function creerFichiersManquants(obtenirJeton: () => Promise<string>): Promise<void> {
  const profils = await baseSuiviABC.profils.filter((profil) => !profil.supprime).toArray()
  for (const profil of profils) {
    if (trouverConfigurationProfil(profil.id) !== undefined) {
      continue
    }
    const sauvegarde = await creerDepotLocalPourProfil(profil.id).lireSauvegarde()
    const identifiantFichier = await creerFichierDrive(
      `${PREFIXE_NOM_FICHIER_PROFIL} ${profil.code}.json`,
      JSON.stringify(sauvegarde),
      obtenirJeton,
    )
    await enregistrerConfigurations([
      ...etatCourant.configurations,
      { profilId: profil.id, identifiantFichier },
    ])
  }
}

async function synchroniserProfils(obtenirJeton: () => Promise<string>): Promise<string[]> {
  const erreurs: string[] = []
  for (const configuration of [...etatCourant.configurations]) {
    try {
      await synchroniser(
        new StockageFichierDrive(configuration.identifiantFichier, obtenirJeton),
        creerDepotLocalPourProfil(configuration.profilId),
      )
    } catch (erreur) {
      if (erreur instanceof ErreurAuthentificationGoogle) {
        throw erreur
      }
      erreurs.push(messageErreurLisible(erreur))
    }
  }
  return erreurs
}

// Une seule synchro à la fois. Renvoie true si elle a réussi.
async function executerSynchro(interactif: boolean): Promise<boolean> {
  if (synchroEnCours !== null) {
    return synchroEnCours
  }
  synchroEnCours = (async () => {
    derniereTentativeLe = Date.now()
    changerEtat({ statut: 'en_cours', messageErreur: '' })
    const obtenirJeton = () => obtenirJetonGoogle(interactif)
    try {
      await obtenirJeton()
      await retrouverProfilsDansDrive(obtenirJeton)
      await creerFichiersManquants(obtenirJeton)
      const erreurs = await synchroniserProfils(obtenirJeton)
      if (erreurs.length > 0) {
        changerEtat({ statut: 'erreur', messageErreur: [...new Set(erreurs)].join(' ') })
        return false
      }
      const termineLe = maintenantHorodatage()
      await ecrireParametre(CLE_DERNIERE_SYNCHRO, termineLe)
      await ecrireParametre(CLE_CONNECTE, 'oui')
      changerEtat({ connecte: true, statut: 'repos', messageErreur: '', derniereSynchroLe: termineLe })
      installerDeclencheurs()
      return true
    } catch (erreur) {
      if (erreur instanceof ErreurAuthentificationGoogle) {
        oublierJetonGoogle()
        // Le message est conservé : lors de la première connexion, c'est la seule trace de la cause.
        changerEtat({ statut: 'reconnexion_necessaire', messageErreur: erreur.message })
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

// Le bouton « Synchroniser » : à appeler depuis un clic (la fenêtre de connexion Google peut s'ouvrir).
export async function synchroniserMaintenant(): Promise<boolean> {
  if (!etatCourant.connecte && doitUtiliserRedirection() && !unJetonEstMemorise()) {
    // iPhone : la page va partir chez Google puis revenir ; la synchro reprend alors toute seule.
    memoriserActionEnAttente('synchro')
  }
  const reussite = await executerSynchro(true)
  // Si la page n'a pas quitté l'application (jeton déjà valable), l'attente n'a plus lieu d'être.
  recupererActionEnAttente('synchro')
  return reussite
}

function synchroEnArrierePlan(): void {
  if (etatCourant.connecte && etatCourant.statut !== 'reconnexion_necessaire') {
    void executerSynchro(false)
  }
}

function planifierSynchroApresModification(): void {
  if (!etatCourant.connecte) {
    return
  }
  if (minuteurApresModification !== null) {
    clearTimeout(minuteurApresModification)
  }
  minuteurApresModification = setTimeout(() => {
    minuteurApresModification = null
    synchroEnArrierePlan()
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
      synchroEnArrierePlan()
    }
  })

  window.addEventListener('online', synchroEnArrierePlan)
  setInterval(synchroEnArrierePlan, DELAI_ENTRE_SYNCHROS_PERIODIQUES_MS)
}

// À appeler une fois au démarrage de l'application.
export async function initialiserSynchro(): Promise<void> {
  if (initialisationFaite || !synchroGoogleEstConfiguree()) {
    return
  }
  initialisationFaite = true
  const [connecte, configurations, derniereSynchro] = await Promise.all([
    lireParametre(CLE_CONNECTE),
    lireParametre(CLE_CONFIGURATIONS),
    lireParametre(CLE_DERNIERE_SYNCHRO),
  ])
  changerEtat({
    connecte: connecte === 'oui',
    configurations: lireConfigurationsEnregistrees(configurations),
    derniereSynchroLe: derniereSynchro ?? null,
  })

  // Retour de Google après une connexion par redirection (iPhone) : on reprend là où on s'était arrêté.
  const reprise = recupererActionEnAttente('synchro')
  const repriseInvitation = recupererActionEnAttente('rejoindre')
  const erreurRedirection = lireErreurRetourRedirection()
  if (reprise !== null || repriseInvitation !== null) {
    if (erreurRedirection !== '' || !unJetonEstMemorise()) {
      // Refus ou échec chez Google : on n'insiste pas, sinon la page repartirait chez Google en boucle.
      changerEtat({
        statut: 'erreur',
        messageErreur: erreurRedirection !== '' ? erreurRedirection : 'La connexion à Google a échoué.',
      })
      return
    }
    if (repriseInvitation !== null) {
      try {
        await rejoindreProfil(repriseInvitation.identifiantFichier)
      } catch (erreur) {
        changerEtat({ statut: 'erreur', messageErreur: messageErreurLisible(erreur) })
      }
      return
    }
    await executerSynchro(true)
    return
  }

  if (etatCourant.connecte) {
    prechargerBibliothequeGoogle()
    installerDeclencheurs()
    void executerSynchro(false)
  }
}

// Rejoindre un profil partagé : connexion Google, un clic dans le sélecteur de fichiers
// (Google ne donne accès qu'aux fichiers choisis), puis tout se synchronise.
// À appeler depuis un clic. Renvoie l'identifiant du profil ajouté (null si le sélecteur est fermé).
export async function rejoindreProfil(identifiantFichierAttendu: string | null): Promise<string | null> {
  const jeton = () => obtenirJetonGoogle(true)
  if (doitUtiliserRedirection() && !unJetonEstMemorise()) {
    memoriserActionEnAttente('rejoindre', identifiantFichierAttendu)
  }
  const jetonObtenu = await jeton()
  recupererActionEnAttente('rejoindre')
  const fichier = await choisirFichierDrive(jetonObtenu, identifiantFichierAttendu)
  if (fichier === null) {
    return null
  }
  if (identifiantFichierAttendu !== null && fichier.identifiant !== identifiantFichierAttendu) {
    throw new Error("Ce n'est pas le fichier de l'invitation. Choisissez le fichier proposé.")
  }
  const contenu = await new StockageFichierDrive(fichier.identifiant, jeton).lire()
  if (contenu === null) {
    throw new Error("Ce fichier est vide : ce n'est pas un profil de Suivi ABC.")
  }
  const sauvegarde = lireSauvegardeDistante(contenu)
  if (sauvegarde.profils.length !== 1) {
    throw new Error("Ce fichier n'est pas un profil partagé de Suivi ABC.")
  }
  const profilId = sauvegarde.profils[0].id
  if (trouverConfigurationProfil(profilId) === undefined) {
    await creerDepotLocalPourProfil(profilId).appliquerSauvegarde(sauvegarde)
    await enregistrerConfigurations([
      ...etatCourant.configurations,
      { profilId, identifiantFichier: fichier.identifiant },
    ])
  }
  oublierInvitation()
  await ecrireParametre(CLE_CONNECTE, 'oui')
  changerEtat({ connecte: true, profilRejointId: profilId })
  installerDeclencheurs()
  await executerSynchro(true)
  return profilId
}

// Les données restent sur l'appareil ; seul le lien avec Google est coupé.
export async function deconnecterGoogle(): Promise<void> {
  revoquerJetonGoogle()
  await ecrireParametre(CLE_CONNECTE, 'non')
  changerEtat({ connecte: false, statut: 'repos', messageErreur: '' })
}

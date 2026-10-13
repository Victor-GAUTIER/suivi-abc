import { ErreurAuthentificationGoogle } from './types'

const URL_BIBLIOTHEQUE_GOOGLE = 'https://accounts.google.com/gsi/client'
// drive.appdata : fichier de synchro caché de l'utilisateur.
// drive.file : fichiers de profils partagés, créés par l'application ou choisis par l'utilisateur.
const PORTEES_GOOGLE =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file'
const MARGE_EXPIRATION_MILLISECONDES = 60_000
const DELAI_TENTATIVE_SILENCIEUSE_MS = 15_000
const DELAI_CONNEXION_INTERACTIVE_MS = 3 * 60_000

interface ReponseJetonGoogle {
  access_token?: string
  expires_in?: number
  error?: string
}

interface ErreurClientGoogle {
  type?: string
  message?: string
}

interface ClientJetonGoogle {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface ConfigurationClientJeton {
  client_id: string
  scope: string
  callback: (reponse: ReponseJetonGoogle) => void
  error_callback?: (erreur: ErreurClientGoogle) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (configuration: ConfigurationClientJeton) => ClientJetonGoogle
          revoke: (jeton: string, termine?: () => void) => void
        }
      }
    }
  }
}

interface JetonMemorise {
  valeur: string
  expireLe: number
}

let jetonMemorise: JetonMemorise | null = null
let demandeJetonEnCours: { promesse: Promise<JetonMemorise>; interactive: boolean } | null = null
let chargementBibliotheque: Promise<void> | null = null

export const identifiantClientGoogle: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''

export const cleApiGoogle: string = (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) ?? ''

export function synchroGoogleEstConfiguree(): boolean {
  return identifiantClientGoogle !== ''
}

// Le sélecteur de fichiers Google a besoin d'une clé d'API (en plus de l'identifiant client).
export function selecteurGoogleEstConfigure(): boolean {
  return identifiantClientGoogle !== '' && cleApiGoogle !== ''
}

// Le numéro du projet Google Cloud est le début de l'identifiant client (avant le premier « - »).
export function numeroProjetGoogle(): string {
  return identifiantClientGoogle.split('-')[0] ?? ''
}

// Charger la bibliothèque à l'avance évite d'attendre le réseau entre le clic de l'utilisateur
// et l'ouverture de la fenêtre Google (certains navigateurs bloquent alors la fenêtre).
// À n'appeler que si l'utilisateur utilise ou configure la synchro : cela contacte Google.
export function prechargerBibliothequeGoogle(): void {
  if (synchroGoogleEstConfiguree()) {
    void chargerBibliothequeGoogle().catch(() => undefined)
  }
}

function chargerBibliothequeGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2 !== undefined) {
    return Promise.resolve()
  }
  if (chargementBibliotheque === null) {
    chargementBibliotheque = new Promise<void>((resoudre, rejeter) => {
      const balise = document.createElement('script')
      balise.src = URL_BIBLIOTHEQUE_GOOGLE
      balise.async = true
      balise.onload = () => resoudre()
      balise.onerror = () => {
        chargementBibliotheque = null
        rejeter(new Error('Impossible de charger la connexion Google (réseau indisponible ?).'))
      }
      document.head.appendChild(balise)
    })
  }
  return chargementBibliotheque
}

// `invite` :
// - 'none'  : tentative silencieuse, sans fenêtre (réussit si l'utilisateur a déjà autorisé l'app) ;
// - ''      : connexion normale, doit être déclenchée par un clic de l'utilisateur.
async function demanderJeton(invite: 'none' | ''): Promise<JetonMemorise> {
  await chargerBibliothequeGoogle()
  const google = window.google
  if (google === undefined) {
    throw new Error('La connexion Google est indisponible.')
  }
  return new Promise<JetonMemorise>((resoudre, rejeter) => {
    // Sans réponse de Google (fenêtre bloquée ou fermée sans événement), la synchro resterait
    // « en cours » indéfiniment : on abandonne après un délai.
    const delaiMaximalMillisecondes =
      invite === 'none' ? DELAI_TENTATIVE_SILENCIEUSE_MS : DELAI_CONNEXION_INTERACTIVE_MS
    const minuterie = setTimeout(() => {
      rejeter(new ErreurAuthentificationGoogle('Google n\'a pas répondu à temps.'))
    }, delaiMaximalMillisecondes)

    const client = google.accounts.oauth2.initTokenClient({
      client_id: identifiantClientGoogle,
      scope: PORTEES_GOOGLE,
      callback: (reponse) => {
        clearTimeout(minuterie)
        if (reponse.error !== undefined || reponse.access_token === undefined) {
          rejeter(
            new ErreurAuthentificationGoogle(`Connexion Google refusée (${reponse.error ?? 'pas de jeton'}).`),
          )
          return
        }
        const dureeSecondes = reponse.expires_in ?? 3600
        resoudre({
          valeur: reponse.access_token,
          expireLe: Date.now() + dureeSecondes * 1000,
        })
      },
      error_callback: (erreur) => {
        clearTimeout(minuterie)
        rejeter(
          new ErreurAuthentificationGoogle(
            `Connexion Google interrompue (${erreur.type ?? erreur.message ?? 'raison inconnue'}).`,
          ),
        )
      },
    })
    client.requestAccessToken({ prompt: invite })
  })
}

// Renvoie un jeton encore valable, sinon en demande un.
// En mode non interactif, la demande est silencieuse et peut échouer :
// il faut alors que l'utilisateur appuie sur « Reconnecter ».
export async function obtenirJetonGoogle(interactif: boolean): Promise<string> {
  const jetonEstValable =
    jetonMemorise !== null && jetonMemorise.expireLe - MARGE_EXPIRATION_MILLISECONDES > Date.now()
  if (jetonEstValable && jetonMemorise !== null) {
    return jetonMemorise.valeur
  }
  // Plusieurs synchros peuvent demander un jeton en même temps : une seule demande part chez Google.
  // Une demande interactive (clic de l'utilisateur) ne réutilise jamais une demande silencieuse.
  if (demandeJetonEnCours === null || (interactif && !demandeJetonEnCours.interactive)) {
    const promesse = demanderJeton(interactif ? '' : 'none')
    const demande = { promesse, interactive: interactif }
    demandeJetonEnCours = demande
    const liberer = () => {
      if (demandeJetonEnCours === demande) {
        demandeJetonEnCours = null
      }
    }
    promesse.then(liberer, liberer)
  }
  jetonMemorise = await demandeJetonEnCours.promesse
  return jetonMemorise.valeur
}

export function oublierJetonGoogle(): void {
  jetonMemorise = null
}

export function revoquerJetonGoogle(): void {
  const jeton = jetonMemorise?.valeur
  jetonMemorise = null
  if (jeton !== undefined) {
    window.google?.accounts?.oauth2?.revoke(jeton)
  }
}

import { ErreurAuthentificationGoogle } from './types'

const URL_BIBLIOTHEQUE_GOOGLE = 'https://accounts.google.com/gsi/client'
const PORTEE_DRIVE_DONNEES_APPLICATION = 'https://www.googleapis.com/auth/drive.appdata'
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
let chargementBibliotheque: Promise<void> | null = null

export const identifiantClientGoogle: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''

export function synchroGoogleEstConfiguree(): boolean {
  return identifiantClientGoogle !== ''
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
      scope: PORTEE_DRIVE_DONNEES_APPLICATION,
      callback: (reponse) => {
        clearTimeout(minuterie)
        if (reponse.error !== undefined || reponse.access_token === undefined) {
          rejeter(new ErreurAuthentificationGoogle(reponse.error ?? 'Connexion Google refusée.'))
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
          new ErreurAuthentificationGoogle(erreur.type ?? erreur.message ?? 'Connexion Google annulée.'),
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
  jetonMemorise = await demanderJeton(interactif ? '' : 'none')
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

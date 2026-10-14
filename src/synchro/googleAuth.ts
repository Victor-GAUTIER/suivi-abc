import {
  demarrerRedirectionGoogle,
  doitUtiliserRedirection,
  lireRetourRedirectionDansLaPage,
} from './redirectionGoogle'
import { ErreurAuthentificationGoogle } from './types'

const URL_BIBLIOTHEQUE_GOOGLE = 'https://accounts.google.com/gsi/client'

// drive.appdata : fichier de synchro caché de l'utilisateur.
// drive.file : fichiers de profils partagés, créés par l'application ou choisis par l'utilisateur.
const PORTEES_GOOGLE =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file'

const MARGE_EXPIRATION_MILLISECONDES = 60_000
const DELAI_TENTATIVE_SILENCIEUSE_MS = 15_000
const DELAI_CONNEXION_INTERACTIVE_MS = 3 * 60_000
const DELAI_GRACE_FERMETURE_MS = 4_000

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
          initTokenClient: (
            configuration: ConfigurationClientJeton,
          ) => ClientJetonGoogle
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

// Retour d'une connexion par redirection (iPhone) : le jeton est dans l'adresse de la page.
let erreurRetourRedirection = ''

const retourRedirection = lireRetourRedirectionDansLaPage()

if (retourRedirection.type === 'jeton') {
  jetonMemorise = {
    valeur: retourRedirection.jeton,
    expireLe: Date.now() + retourRedirection.dureeSecondes * 1000,
  }
} else if (retourRedirection.type === 'erreur') {
  erreurRetourRedirection = `Connexion Google refusée (${retourRedirection.message}).`
}

export function unJetonEstMemorise(): boolean {
  return jetonMemorise !== null && jetonMemorise.expireLe > Date.now()
}

// Non consommé : la synchro personnelle et le partage de profils peuvent chacun le lire au démarrage.
export function lireErreurRetourRedirection(): string {
  return erreurRetourRedirection
}

let demandeJetonEnCours: {
  promesse: Promise<JetonMemorise>
  interactive: boolean
} | null = null

let chargementBibliotheque: Promise<void> | null = null

// trim() : une valeur copiée dans une variable GitHub peut contenir un retour à la ligne ou un
// espace invisible à la fin, ce qui rendrait l'identifiant inconnu de Google.
export const identifiantClientGoogle: string = (
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? ''
).trim()

export const cleApiGoogle: string = (
  (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) ?? ''
).trim()

export function synchroGoogleEstConfiguree(): boolean {
  return identifiantClientGoogle !== ''
}

// Le sélecteur de fichiers Google a besoin d'une clé d'API.
export function selecteurGoogleEstConfigure(): boolean {
  return identifiantClientGoogle !== '' && cleApiGoogle !== ''
}

// Le numéro du projet Google Cloud est le début de l'identifiant client.
export function numeroProjetGoogle(): string {
  return identifiantClientGoogle.split('-')[0] ?? ''
}

// Charger la bibliothèque à l'avance évite d'attendre le réseau
// entre le clic de l'utilisateur et l'ouverture de la fenêtre Google.
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
        rejeter(
          new Error(
            'Impossible de charger la connexion Google (réseau indisponible ?).',
          ),
        )
      }

      document.head.appendChild(balise)
    })
  }

  return chargementBibliotheque
}

// invite :
// - 'none' : tentative silencieuse, sans fenêtre ;
// - 'consent' : connexion interactive. Seule valeur observée fonctionnelle sur le site en ligne :
//   avec une invite vide ou 'select_account', la fenêtre se fermait sans renvoyer de jeton (popup_closed).
async function demanderJeton(
  invite: 'none' | 'consent',
): Promise<JetonMemorise> {
  await chargerBibliothequeGoogle()

  const google = window.google

  if (google === undefined) {
    throw new Error('La connexion Google est indisponible.')
  }

  return new Promise<JetonMemorise>((resoudre, rejeter) => {
    const delaiMaximalMillisecondes =
      invite === 'none'
        ? DELAI_TENTATIVE_SILENCIEUSE_MS
        : DELAI_CONNEXION_INTERACTIVE_MS

    let termine = false
    let minuterieFermeture: ReturnType<typeof setTimeout> | null = null
    const debut = Date.now()
    const tracer = (evenement: string) => {
      console.info(`[Google] ${evenement} (+${Date.now() - debut} ms)`)
    }
    const terminerAvecErreur = (erreur: Error) => {
      if (termine) {
        return
      }

      termine = true
      clearTimeout(minuterie)
      if (minuterieFermeture !== null) {
        clearTimeout(minuterieFermeture)
      }
      rejeter(erreur)
    }

    const minuterie = setTimeout(() => {
      terminerAvecErreur(
        new ErreurAuthentificationGoogle(
          "Google n'a pas répondu à temps.",
        ),
      )
    }, delaiMaximalMillisecondes)

    const client = google.accounts.oauth2.initTokenClient({
      client_id: identifiantClientGoogle,
      scope: PORTEES_GOOGLE,

      callback: (reponse) => {
        tracer(reponse.access_token !== undefined ? 'jeton reçu' : `réponse sans jeton (${reponse.error ?? '?'})`)
        // Ignore une réponse tardive si la demande est déjà terminée.
        if (termine) {
          return
        }

        if (
          reponse.error !== undefined ||
          reponse.access_token === undefined
        ) {
          terminerAvecErreur(
            new ErreurAuthentificationGoogle(
              `Connexion Google refusée (${reponse.error ?? 'pas de jeton'}).`,
            ),
          )
          return
        }

        termine = true
          clearTimeout(minuterie)
        if (minuterieFermeture !== null) {
          clearTimeout(minuterieFermeture)
        }

        const dureeSecondes = reponse.expires_in ?? 3600

        resoudre({
          valeur: reponse.access_token,
          expireLe: Date.now() + dureeSecondes * 1000,
        })
      },

      error_callback: (erreur) => {
        tracer(`erreur Google : ${erreur.type ?? erreur.message ?? 'inconnue'}`)
        // Ignore notamment un événement de fermeture tardif
        // si le jeton a déjà été reçu.
        if (erreur.type === 'popup_closed' && !termine) {
          // La fermeture de la fenêtre peut être signalée avant l'arrivée du jeton
          // (Google ne peut pas toujours surveiller la fenêtre : politique COOP).
          // On laisse un court délai au jeton avant de conclure à un abandon.
          if (minuterieFermeture === null) {
            minuterieFermeture = setTimeout(() => {
              terminerAvecErreur(
                new ErreurAuthentificationGoogle(
                  'Connexion Google interrompue (popup_closed).',
                ),
              )
            }, DELAI_GRACE_FERMETURE_MS)
          }
          return
        }
        terminerAvecErreur(
          new ErreurAuthentificationGoogle(
            `Connexion Google interrompue (${erreur.type ?? erreur.message ?? 'raison inconnue'}).`,
          ),
        )
      },
    })

    tracer(`demande (invite=${invite})`)
    client.requestAccessToken({ prompt: invite })
  })
}

// Renvoie un jeton encore valable, sinon en demande un.
// En mode non interactif, la demande est silencieuse.
export async function obtenirJetonGoogle(
  interactif: boolean,
): Promise<string> {
  const jetonEstValable =
    jetonMemorise !== null &&
    jetonMemorise.expireLe - MARGE_EXPIRATION_MILLISECONDES >
      Date.now()

  if (jetonEstValable && jetonMemorise !== null) {
    return jetonMemorise.valeur
  }

  // iPhone/iPad : pas de popup. Connexion par redirection de la page entière.
  if (doitUtiliserRedirection()) {
    if (!interactif) {
      throw new ErreurAuthentificationGoogle('Reconnexion à Google nécessaire.')
    }
    demarrerRedirectionGoogle(identifiantClientGoogle, PORTEES_GOOGLE)
    // La page quitte l'application : cette promesse ne se termine jamais.
    return new Promise<string>(() => undefined)
  }

  // Une demande interactive ne réutilise pas une demande silencieuse.
  if (
    demandeJetonEnCours === null ||
    (interactif && !demandeJetonEnCours.interactive)
  ) {
    const promesse = demanderJeton(
      interactif ? 'consent' : 'none',
    )

    const demande = {
      promesse,
      interactive: interactif,
    }

    demandeJetonEnCours = demande

    const liberer = () => {
      if (demandeJetonEnCours === demande) {
        demandeJetonEnCours = null
      }
    }

    promesse.then(liberer, liberer)
  }

  const demande = demandeJetonEnCours

  if (demande === null) {
    throw new ErreurAuthentificationGoogle(
      'Impossible de démarrer la connexion Google.',
    )
  }

  jetonMemorise = await demande.promesse

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

import { cleApiGoogle, numeroProjetGoogle, selecteurGoogleEstConfigure } from '../synchro/googleAuth'

const URL_BIBLIOTHEQUE_API_GOOGLE = 'https://apis.google.com/js/api.js'

interface DocumentChoisi {
  id: string
  name?: string
}

interface DonneesRetourSelecteur {
  action?: string
  docs?: DocumentChoisi[]
}

interface VueSelecteur {
  setMimeTypes: (types: string) => VueSelecteur
  setOwnedByMe: (proprietaire: boolean) => VueSelecteur
  setLabel?: (libelle: string) => VueSelecteur
}

interface ConstructeurSelecteur {
  setOAuthToken: (jeton: string) => ConstructeurSelecteur
  setDeveloperKey: (cle: string) => ConstructeurSelecteur
  setAppId: (identifiant: string) => ConstructeurSelecteur
  setLocale: (langue: string) => ConstructeurSelecteur
  addView: (vue: VueSelecteur) => ConstructeurSelecteur
  setCallback: (rappel: (donnees: DonneesRetourSelecteur) => void) => ConstructeurSelecteur
  build: () => { setVisible: (visible: boolean) => void }
}

interface BibliothequeSelecteur {
  PickerBuilder: new () => ConstructeurSelecteur
  DocsView: new () => VueSelecteur
}

declare global {
  interface Window {
    gapi?: { load: (nom: string, options: { callback: () => void; onerror?: () => void }) => void }
  }
}

let chargementSelecteur: Promise<void> | null = null

function chargerSelecteurGoogle(): Promise<void> {
  if (chargementSelecteur === null) {
    chargementSelecteur = new Promise<void>((resoudre, rejeter) => {
      const echec = () => {
        chargementSelecteur = null
        rejeter(new Error('Impossible de charger le sélecteur de fichiers Google.'))
      }
      const balise = document.createElement('script')
      balise.src = URL_BIBLIOTHEQUE_API_GOOGLE
      balise.async = true
      balise.onload = () => {
        if (window.gapi === undefined) {
          echec()
          return
        }
        window.gapi.load('picker', { callback: () => resoudre(), onerror: echec })
      }
      balise.onerror = echec
      document.head.appendChild(balise)
    })
  }
  return chargementSelecteur
}

function lireBibliothequeSelecteur(): BibliothequeSelecteur {
  const picker = (window.google as unknown as { picker?: BibliothequeSelecteur } | undefined)?.picker
  if (picker === undefined) {
    throw new Error('Le sélecteur de fichiers Google est indisponible.')
  }
  return picker
}

export interface FichierChoisi {
  identifiant: string
  nom: string
}

// Ouvre le sélecteur de fichiers Google. Choisir un fichier donne à l'application l'accès à ce
// seul fichier (portée « drive.file »). Renvoie null si l'utilisateur ferme la fenêtre.
export async function choisirFichierDrive(jeton: string): Promise<FichierChoisi | null> {
  if (!selecteurGoogleEstConfigure()) {
    throw new Error(
      "Le sélecteur de fichiers Google n'est pas configuré dans cette version (clé d'API manquante).",
    )
  }
  await chargerSelecteurGoogle()
  const picker = lireBibliothequeSelecteur()
  return new Promise<FichierChoisi | null>((resoudre) => {
    const vueMesFichiers = new picker.DocsView().setMimeTypes('application/json')
    const vuePartages = new picker.DocsView().setMimeTypes('application/json').setOwnedByMe(false)
    const selecteur = new picker.PickerBuilder()
      .setOAuthToken(jeton)
      .setDeveloperKey(cleApiGoogle)
      .setAppId(numeroProjetGoogle())
      .setLocale('fr')
      .addView(vueMesFichiers)
      .addView(vuePartages)
      .setCallback((donnees) => {
        if (donnees.action === 'picked' && donnees.docs !== undefined && donnees.docs.length > 0) {
          const document = donnees.docs[0]
          resoudre({ identifiant: document.id, nom: document.name ?? '' })
        } else if (donnees.action === 'cancel') {
          resoudre(null)
        }
      })
      .build()
    selecteur.setVisible(true)
  })
}

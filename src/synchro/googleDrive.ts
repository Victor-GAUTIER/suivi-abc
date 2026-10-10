import { ErreurAuthentificationGoogle } from './types'
import type { StockageDistant } from './types'

const NOM_FICHIER_SYNCHRO = 'suivi-abc-synchro.json'
const URL_API_DRIVE = 'https://www.googleapis.com/drive/v3/files'
const URL_API_TELEVERSEMENT = 'https://www.googleapis.com/upload/drive/v3/files'

type FonctionFetch = typeof fetch

// Stockage dans le dossier caché de l'application sur le Google Drive de l'utilisateur
// (espace « appDataFolder » : invisible dans Drive et inaccessible aux autres applications).
export class StockageGoogleDrive implements StockageDistant {
  private identifiantFichier: string | null = null

  constructor(
    private readonly obtenirJeton: () => Promise<string>,
    private readonly appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
  ) {}

  private async appeler(url: string, options: RequestInit = {}): Promise<Response> {
    const jeton = await this.obtenirJeton()
    const reponse = await this.appelerReseau(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${jeton}` },
    })
    if (reponse.status === 401) {
      throw new ErreurAuthentificationGoogle('Connexion Google expirée.')
    }
    if (!reponse.ok) {
      throw new Error(`Google Drive a répondu avec l'erreur ${reponse.status}.`)
    }
    return reponse
  }

  private async trouverIdentifiantFichier(): Promise<string | null> {
    if (this.identifiantFichier !== null) {
      return this.identifiantFichier
    }
    const requete = `name='${NOM_FICHIER_SYNCHRO}' and trashed=false`
    // Si deux appareils créent le fichier en même temps, il en existe deux. Le tri par date de
    // création fait choisir le même (le plus ancien) sur tous les appareils : ils convergent.
    const url =
      `${URL_API_DRIVE}?spaces=appDataFolder&pageSize=10&fields=files(id)` +
      `&orderBy=createdTime&q=${encodeURIComponent(requete)}`
    const reponse = await this.appeler(url)
    const resultat = (await reponse.json()) as { files?: Array<{ id: string }> }
    this.identifiantFichier = resultat.files?.[0]?.id ?? null
    return this.identifiantFichier
  }

  async lire(): Promise<string | null> {
    const identifiant = await this.trouverIdentifiantFichier()
    if (identifiant === null) {
      return null
    }
    const reponse = await this.appeler(`${URL_API_DRIVE}/${identifiant}?alt=media`)
    return reponse.text()
  }

  async ecrire(contenu: string): Promise<void> {
    const identifiant = await this.trouverIdentifiantFichier()
    if (identifiant !== null) {
      await this.appeler(`${URL_API_TELEVERSEMENT}/${identifiant}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: contenu,
      })
      return
    }
    const separateur = `suivi-abc-${crypto.randomUUID()}`
    const metadonnees = JSON.stringify({
      name: NOM_FICHIER_SYNCHRO,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    })
    const corps =
      `--${separateur}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadonnees}\r\n` +
      `--${separateur}\r\nContent-Type: application/json\r\n\r\n${contenu}\r\n` +
      `--${separateur}--`
    const reponse = await this.appeler(`${URL_API_TELEVERSEMENT}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${separateur}` },
      body: corps,
    })
    const resultat = (await reponse.json()) as { id?: string }
    this.identifiantFichier = resultat.id ?? null
  }
}

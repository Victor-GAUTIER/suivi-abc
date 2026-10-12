import { appelerDrive, URL_API_DRIVE, URL_API_TELEVERSEMENT } from './appelerDrive'
import type { FonctionFetch } from './appelerDrive'
import type { StockageDistant } from './types'

const NOM_FICHIER_SYNCHRO = 'suivi-abc-synchro.json'

function construireCorpsMultipart(
  separateur: string,
  metadonnees: Record<string, unknown>,
  contenu: string,
): string {
  return (
    `--${separateur}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadonnees)}\r\n` +
    `--${separateur}\r\nContent-Type: application/json\r\n\r\n${contenu}\r\n` +
    `--${separateur}--`
  )
}

// Stockage dans le dossier caché de l'application sur le Google Drive de l'utilisateur
// (espace « appDataFolder » : invisible dans Drive et inaccessible aux autres applications).
export class StockageGoogleDrive implements StockageDistant {
  private identifiantFichier: string | null = null

  constructor(
    private readonly obtenirJeton: () => Promise<string>,
    private readonly appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
  ) {}

  private appeler(url: string, options: RequestInit = {}): Promise<Response> {
    return appelerDrive(this.obtenirJeton, this.appelerReseau, url, options)
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
    const corps = construireCorpsMultipart(
      separateur,
      { name: NOM_FICHIER_SYNCHRO, parents: ['appDataFolder'], mimeType: 'application/json' },
      contenu,
    )
    const reponse = await this.appeler(`${URL_API_TELEVERSEMENT}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${separateur}` },
      body: corps,
    })
    const resultat = (await reponse.json()) as { id?: string }
    this.identifiantFichier = resultat.id ?? null
  }
}

// Fichier ordinaire (visible dans « Mon Drive »), identifié par son id : c'est lui qu'on partage.
export class StockageFichierDrive implements StockageDistant {
  constructor(
    private readonly identifiantFichier: string,
    private readonly obtenirJeton: () => Promise<string>,
    private readonly appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
  ) {}

  async lire(): Promise<string | null> {
    const reponse = await appelerDrive(
      this.obtenirJeton,
      this.appelerReseau,
      `${URL_API_DRIVE}/${this.identifiantFichier}?alt=media`,
    )
    const contenu = await reponse.text()
    return contenu === '' ? null : contenu
  }

  async ecrire(contenu: string): Promise<void> {
    await appelerDrive(
      this.obtenirJeton,
      this.appelerReseau,
      `${URL_API_TELEVERSEMENT}/${this.identifiantFichier}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: contenu,
      },
    )
  }
}

// Crée le fichier à la racine de « Mon Drive » et renvoie son identifiant.
export async function creerFichierDrive(
  nomFichier: string,
  contenu: string,
  obtenirJeton: () => Promise<string>,
  appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
): Promise<string> {
  const separateur = `suivi-abc-${crypto.randomUUID()}`
  const corps = construireCorpsMultipart(
    separateur,
    { name: nomFichier, mimeType: 'application/json' },
    contenu,
  )
  const reponse = await appelerDrive(
    obtenirJeton,
    appelerReseau,
    `${URL_API_TELEVERSEMENT}?uploadType=multipart&fields=id`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${separateur}` },
      body: corps,
    },
  )
  const resultat = (await reponse.json()) as { id?: string }
  if (resultat.id === undefined) {
    throw new Error("Google Drive n'a pas renvoyé l'identifiant du fichier créé.")
  }
  return resultat.id
}

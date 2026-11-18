import { appelerDrive, URL_API_DRIVE, URL_API_TELEVERSEMENT } from './appelerDrive'
import type { FonctionFetch } from './appelerDrive'
import type { StockageDistant } from './types'

export const PREFIXE_NOM_FICHIER_PROFIL = 'Suivi ABC - profil'

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

export interface FichierProfilDrive {
  identifiant: string
  nom: string
}

// Liste les fichiers de profil que l'application peut voir dans le Drive de l'utilisateur :
// ceux qu'elle a créés (sur n'importe quel appareil) et ceux qu'il a choisis dans le sélecteur Google.
export async function listerFichiersProfils(
  obtenirJeton: () => Promise<string>,
  appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
): Promise<FichierProfilDrive[]> {
  const requete = `name contains '${PREFIXE_NOM_FICHIER_PROFIL}' and trashed=false`
  const url =
    `${URL_API_DRIVE}?spaces=drive&pageSize=100&orderBy=createdTime&fields=files(id,name)` +
    `&q=${encodeURIComponent(requete)}`
  const reponse = await appelerDrive(obtenirJeton, appelerReseau, url)
  const resultat = (await reponse.json()) as { files?: Array<{ id: string; name?: string }> }
  return (resultat.files ?? []).map((fichier) => ({ identifiant: fichier.id, nom: fichier.name ?? '' }))
}

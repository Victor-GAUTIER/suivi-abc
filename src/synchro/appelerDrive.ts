import { ErreurAccesFichierDrive, ErreurAuthentificationGoogle } from './types'

export type FonctionFetch = typeof fetch

export const URL_API_DRIVE = 'https://www.googleapis.com/drive/v3/files'
export const URL_API_TELEVERSEMENT = 'https://www.googleapis.com/upload/drive/v3/files'

// Appel authentifié à l'API Google Drive, avec des erreurs lisibles :
// - 401 : la connexion Google a expiré ;
// - 403 / 404 : le fichier est inaccessible (droits insuffisants, accès retiré, fichier supprimé).
export async function appelerDrive(
  obtenirJeton: () => Promise<string>,
  appelerReseau: FonctionFetch,
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const jeton = await obtenirJeton()
  const reponse = await appelerReseau(url, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${jeton}` },
  })
  if (reponse.status === 401) {
    throw new ErreurAuthentificationGoogle('Connexion Google expirée.')
  }
  if (reponse.status === 403) {
    throw new ErreurAccesFichierDrive(
      "Google a refusé l'accès (droits insuffisants, accès retiré ou quota dépassé).",
    )
  }
  if (reponse.status === 404) {
    throw new ErreurAccesFichierDrive('Fichier introuvable : il a été supprimé ou son accès retiré.')
  }
  if (!reponse.ok) {
    throw new Error(`Google Drive a répondu avec l'erreur ${reponse.status}.`)
  }
  return reponse
}

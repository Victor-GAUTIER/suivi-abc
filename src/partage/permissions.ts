import { appelerDrive, URL_API_DRIVE } from '../synchro/appelerDrive'
import type { FonctionFetch } from '../synchro/appelerDrive'

export type RolePartage = 'reader' | 'writer'

export const LIBELLES_ROLES: Record<string, string> = {
  owner: 'Propriétaire',
  writer: 'Peut modifier',
  reader: 'Lecture seule',
  commenter: 'Peut commenter',
}

export interface PersonneAvecAcces {
  identifiantPermission: string
  adresseEmail: string
  nomAffiche: string
  role: string
}

interface PermissionDrive {
  id: string
  type?: string
  role?: string
  emailAddress?: string
  displayName?: string
}

export async function listerPersonnesAvecAcces(
  identifiantFichier: string,
  obtenirJeton: () => Promise<string>,
  appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
): Promise<PersonneAvecAcces[]> {
  const url =
    `${URL_API_DRIVE}/${identifiantFichier}/permissions` +
    `?fields=permissions(id,type,role,emailAddress,displayName)`
  const reponse = await appelerDrive(obtenirJeton, appelerReseau, url)
  const resultat = (await reponse.json()) as { permissions?: PermissionDrive[] }
  return (resultat.permissions ?? [])
    .filter((permission) => permission.type === 'user')
    .map((permission) => ({
      identifiantPermission: permission.id,
      adresseEmail: permission.emailAddress ?? '',
      nomAffiche: permission.displayName ?? '',
      role: permission.role ?? 'reader',
    }))
}

// Google envoie un e-mail d'invitation à la personne.
export async function inviterPersonne(
  identifiantFichier: string,
  adresseEmail: string,
  role: RolePartage,
  obtenirJeton: () => Promise<string>,
  appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
): Promise<void> {
  const url = `${URL_API_DRIVE}/${identifiantFichier}/permissions?sendNotificationEmail=true`
  await appelerDrive(obtenirJeton, appelerReseau, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'user', role, emailAddress: adresseEmail.trim() }),
  })
}

export async function retirerAcces(
  identifiantFichier: string,
  identifiantPermission: string,
  obtenirJeton: () => Promise<string>,
  appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
): Promise<void> {
  const url = `${URL_API_DRIVE}/${identifiantFichier}/permissions/${identifiantPermission}`
  await appelerDrive(obtenirJeton, appelerReseau, url, { method: 'DELETE' })
}

export interface DroitsSurFichier {
  estProprietaire: boolean
  peutPartager: boolean
  peutModifier: boolean
}

export async function lireDroitsSurFichier(
  identifiantFichier: string,
  obtenirJeton: () => Promise<string>,
  appelerReseau: FonctionFetch = (...parametres) => fetch(...parametres),
): Promise<DroitsSurFichier> {
  const url = `${URL_API_DRIVE}/${identifiantFichier}?fields=ownedByMe,capabilities(canShare,canEdit)`
  const reponse = await appelerDrive(obtenirJeton, appelerReseau, url)
  const resultat = (await reponse.json()) as {
    ownedByMe?: boolean
    capabilities?: { canShare?: boolean; canEdit?: boolean }
  }
  return {
    estProprietaire: resultat.ownedByMe === true,
    peutPartager: resultat.capabilities?.canShare === true,
    peutModifier: resultat.capabilities?.canEdit === true,
  }
}

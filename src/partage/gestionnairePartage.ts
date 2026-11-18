import { obtenirJetonGoogle } from '../synchro/googleAuth'
import { trouverConfigurationProfil } from '../synchro/gestionnaire'
import {
  inviterPersonne,
  listerPersonnesAvecAcces,
  lireDroitsSurFichier,
  retirerAcces,
} from './permissions'
import type { DroitsSurFichier, PersonneAvecAcces, RolePartage } from './permissions'

// Actions de partage d'un profil. Le fichier du profil est créé par la synchronisation ;
// ces actions s'appliquent donc à un profil déjà synchronisé.

function identifiantFichierObligatoire(profilId: string): string {
  const configuration = trouverConfigurationProfil(profilId)
  if (configuration === undefined) {
    throw new Error("Ce profil n'est pas encore synchronisé : appuyez d'abord sur « Synchroniser ».")
  }
  return configuration.identifiantFichier
}

export async function lireDroitsPartage(profilId: string): Promise<DroitsSurFichier> {
  return lireDroitsSurFichier(identifiantFichierObligatoire(profilId), () => obtenirJetonGoogle(true))
}

export async function listerAccesPartage(profilId: string): Promise<PersonneAvecAcces[]> {
  return listerPersonnesAvecAcces(identifiantFichierObligatoire(profilId), () => obtenirJetonGoogle(true))
}

// L'e-mail d'invitation envoyé par Google contient messageInvitation (le lien qui ouvre le profil).
export async function inviterAccesPartage(
  profilId: string,
  adresseEmail: string,
  role: RolePartage,
  messageInvitation: string | null = null,
): Promise<void> {
  await inviterPersonne(
    identifiantFichierObligatoire(profilId),
    adresseEmail,
    role,
    () => obtenirJetonGoogle(true),
    undefined,
    messageInvitation,
  )
}

export async function retirerAccesPartage(profilId: string, identifiantPermission: string): Promise<void> {
  await retirerAcces(identifiantFichierObligatoire(profilId), identifiantPermission, () =>
    obtenirJetonGoogle(true),
  )
}

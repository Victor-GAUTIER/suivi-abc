import type { Sauvegarde } from '../types'

// Un profil partagé n'envoie et ne reçoit que ses propres données :
// le profil lui-même et ses saisies. Les types de comportement (simples libellés) sont communs.
// Cela empêche un fichier partagé d'exposer ou d'injecter d'autres profils.
export function extraireSauvegardeDuProfil(sauvegarde: Sauvegarde, profilId: string): Sauvegarde {
  return {
    ...sauvegarde,
    profils: sauvegarde.profils.filter((profil) => profil.id === profilId),
    entrees: sauvegarde.entrees.filter((entree) => entree.profilId === profilId),
  }
}

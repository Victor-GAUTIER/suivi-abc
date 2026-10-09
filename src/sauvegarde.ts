import { chiffrerTexte, dechiffrerTexte, estEnveloppeChiffree } from './chiffrement'
import type { EnveloppeChiffree, Sauvegarde } from './types'

function estTableauDObjets(valeur: unknown): valeur is Array<Record<string, unknown>> {
  return (
    Array.isArray(valeur) &&
    valeur.every((element) => typeof element === 'object' && element !== null)
  )
}

function possedeIdentifiantEtDate(element: Record<string, unknown>): boolean {
  return typeof element.id === 'string' && typeof element.modifieLe === 'string'
}

export function validerSauvegarde(valeur: unknown): Sauvegarde {
  if (typeof valeur !== 'object' || valeur === null) {
    throw new Error("Le fichier n'est pas une sauvegarde valide.")
  }
  const candidat = valeur as Record<string, unknown>
  const tableauxPresents =
    estTableauDObjets(candidat.profils) &&
    estTableauDObjets(candidat.typesComportement) &&
    estTableauDObjets(candidat.entrees)
  if (candidat.version !== 1 || !tableauxPresents) {
    throw new Error("Le fichier n'est pas une sauvegarde valide.")
  }
  const tousLesElements = [
    ...(candidat.profils as Array<Record<string, unknown>>),
    ...(candidat.typesComportement as Array<Record<string, unknown>>),
    ...(candidat.entrees as Array<Record<string, unknown>>),
  ]
  if (!tousLesElements.every(possedeIdentifiantEtDate)) {
    throw new Error('La sauvegarde contient des éléments sans identifiant ou sans date.')
  }
  return valeur as Sauvegarde
}

export async function serialiserSauvegarde(
  sauvegarde: Sauvegarde,
  motDePasse: string | null,
): Promise<string> {
  const texteClair = JSON.stringify(sauvegarde)
  if (motDePasse === null || motDePasse === '') {
    return JSON.stringify(sauvegarde, null, 2)
  }
  const enveloppe = await chiffrerTexte(texteClair, motDePasse)
  return JSON.stringify(enveloppe)
}

export type ContenuLu =
  | { type: 'clair'; sauvegarde: Sauvegarde }
  | { type: 'chiffre'; enveloppe: EnveloppeChiffree }

export function lireContenuFichier(texteFichier: string): ContenuLu {
  let valeurLue: unknown
  try {
    valeurLue = JSON.parse(texteFichier)
  } catch {
    throw new Error("Le fichier n'est pas un JSON valide.")
  }
  if (estEnveloppeChiffree(valeurLue)) {
    return { type: 'chiffre', enveloppe: valeurLue }
  }
  return { type: 'clair', sauvegarde: validerSauvegarde(valeurLue) }
}

export async function dechiffrerSauvegarde(
  enveloppe: EnveloppeChiffree,
  motDePasse: string,
): Promise<Sauvegarde> {
  const texteClair = await dechiffrerTexte(enveloppe, motDePasse)
  let valeurLue: unknown
  try {
    valeurLue = JSON.parse(texteClair)
  } catch {
    throw new Error('Contenu déchiffré illisible.')
  }
  return validerSauvegarde(valeurLue)
}

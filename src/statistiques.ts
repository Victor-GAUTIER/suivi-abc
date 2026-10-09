import { heureDeDateHeure } from './dates'
import type { EntreeABC } from './types'

export interface ComptageParLibelle {
  libelle: string
  nombre: number
}

export function compterParType(
  entrees: EntreeABC[],
  nomTypeParIdentifiant: Map<string, string>,
): ComptageParLibelle[] {
  const comptes = new Map<string, number>()
  for (const entree of entrees) {
    const nomType = nomTypeParIdentifiant.get(entree.typeId) ?? 'Type supprimé'
    comptes.set(nomType, (comptes.get(nomType) ?? 0) + 1)
  }
  return trierParNombreDecroissant(comptes)
}

export function compterParHeure(entrees: EntreeABC[]): number[] {
  const comptesParHeure = new Array<number>(24).fill(0)
  for (const entree of entrees) {
    const heure = heureDeDateHeure(entree.dateHeure)
    if (heure >= 0 && heure <= 23) {
      comptesParHeure[heure] += 1
    }
  }
  return comptesParHeure
}

export function compterParLieu(entrees: EntreeABC[]): ComptageParLibelle[] {
  const comptes = new Map<string, number>()
  for (const entree of entrees) {
    const lieu = entree.lieu.trim()
    if (lieu !== '') {
      comptes.set(lieu, (comptes.get(lieu) ?? 0) + 1)
    }
  }
  return trierParNombreDecroissant(comptes)
}

export function compterParPersonnePresente(entrees: EntreeABC[]): ComptageParLibelle[] {
  const comptes = new Map<string, number>()
  for (const entree of entrees) {
    for (const personne of entree.personnesPresentes) {
      const personneNettoyee = personne.trim()
      if (personneNettoyee !== '') {
        comptes.set(personneNettoyee, (comptes.get(personneNettoyee) ?? 0) + 1)
      }
    }
  }
  return trierParNombreDecroissant(comptes)
}

function trierParNombreDecroissant(comptes: Map<string, number>): ComptageParLibelle[] {
  return Array.from(comptes.entries())
    .map(([libelle, nombre]) => ({ libelle, nombre }))
    .sort((comptageA, comptageB) => comptageB.nombre - comptageA.nombre)
}

export function decouperListeTexte(texteSaisi: string): string[] {
  return texteSaisi
    .split(/[;,]/)
    .map((element) => element.trim())
    .filter((element) => element !== '')
}

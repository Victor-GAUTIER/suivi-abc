import type { EntreeABC } from './types'

export interface ListesConnues {
  lieux: string[]
  personnes: string[]
  auteurs: string[]
}

// Retire les valeurs vides, ignore la casse pour détecter les doublons
// (« salle » et « Salle » comptent pour une seule valeur) et trie en français.
function dedoublonnerEtTrier(valeurs: string[]): string[] {
  const valeursParCleNormalisee = new Map<string, string>()
  for (const valeur of valeurs) {
    const valeurNettoyee = valeur.trim()
    if (valeurNettoyee === '') {
      continue
    }
    const cleNormalisee = valeurNettoyee.toLocaleLowerCase('fr')
    if (!valeursParCleNormalisee.has(cleNormalisee)) {
      valeursParCleNormalisee.set(cleNormalisee, valeurNettoyee)
    }
  }
  return Array.from(valeursParCleNormalisee.values()).sort((valeurA, valeurB) =>
    valeurA.localeCompare(valeurB, 'fr'),
  )
}

// Les listes de choix sont déduites des entrées déjà enregistrées.
// Elles voyagent donc avec les données lors de l'export, de l'import et de la synchro.
export function extraireListesConnues(
  entrees: EntreeABC[],
  auteurParDefaut: string,
): ListesConnues {
  const entreesActives = entrees.filter((entree) => !entree.supprime)
  return {
    lieux: dedoublonnerEtTrier(entreesActives.map((entree) => entree.lieu)),
    personnes: dedoublonnerEtTrier(entreesActives.flatMap((entree) => entree.personnesPresentes)),
    auteurs: dedoublonnerEtTrier([
      auteurParDefaut,
      ...entreesActives.map((entree) => entree.auteur),
    ]),
  }
}

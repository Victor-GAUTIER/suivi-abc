import type { ElementSynchronisable } from './types'

export function fusionnerParIdentifiant<T extends ElementSynchronisable>(
  elementsLocaux: T[],
  elementsDistants: T[],
): T[] {
  const elementsParIdentifiant = new Map<string, T>()
  for (const elementLocal of elementsLocaux) {
    elementsParIdentifiant.set(elementLocal.id, elementLocal)
  }
  for (const elementDistant of elementsDistants) {
    const elementExistant = elementsParIdentifiant.get(elementDistant.id)
    const distantEstPlusRecent =
      elementExistant === undefined ||
      elementDistant.modifieLe > elementExistant.modifieLe
    if (distantEstPlusRecent) {
      elementsParIdentifiant.set(elementDistant.id, elementDistant)
    }
  }
  return Array.from(elementsParIdentifiant.values())
}

// Renvoie uniquement les éléments entrants qui sont nouveaux ou strictement plus récents
// que ceux déjà présents. Sert à n'écrire que ce qui change réellement (synchro).
export function elementsAEcrire<T extends ElementSynchronisable>(
  elementsExistants: T[],
  elementsEntrants: T[],
): T[] {
  const elementsExistantsParIdentifiant = new Map<string, T>()
  for (const elementExistant of elementsExistants) {
    elementsExistantsParIdentifiant.set(elementExistant.id, elementExistant)
  }
  const elementsRetenusParIdentifiant = new Map<string, T>()
  for (const elementEntrant of elementsEntrants) {
    const elementExistant = elementsExistantsParIdentifiant.get(elementEntrant.id)
    const elementDejaRetenu = elementsRetenusParIdentifiant.get(elementEntrant.id)
    const plusRecentQueExistant =
      elementExistant === undefined || elementEntrant.modifieLe > elementExistant.modifieLe
    const plusRecentQueRetenu =
      elementDejaRetenu === undefined || elementEntrant.modifieLe > elementDejaRetenu.modifieLe
    if (plusRecentQueExistant && plusRecentQueRetenu) {
      elementsRetenusParIdentifiant.set(elementEntrant.id, elementEntrant)
    }
  }
  return Array.from(elementsRetenusParIdentifiant.values())
}

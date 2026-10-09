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

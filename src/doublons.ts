function normaliserNom(nom: string): string {
  return nom.trim().toLowerCase()
}

// Cherche un élément portant déjà ce nom (sans tenir compte des majuscules ni des espaces autour).
// Un élément actif est préféré à un élément supprimé.
export function trouverElementDeMemeNom<T extends { supprime: boolean }>(
  elements: T[],
  nomRecherche: string,
  lireNom: (element: T) => string,
): T | undefined {
  const nomNormalise = normaliserNom(nomRecherche)
  const elementsDeMemeNom = elements.filter(
    (element) => normaliserNom(lireNom(element)) === nomNormalise,
  )
  const elementActif = elementsDeMemeNom.find((element) => !element.supprime)
  return elementActif ?? elementsDeMemeNom[0]
}

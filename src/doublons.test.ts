import { describe, expect, it } from 'vitest'
import { trouverElementDeMemeNom } from './doublons'

interface Element {
  id: string
  nom: string
  supprime: boolean
}

const lireNom = (element: Element) => element.nom

describe('trouverElementDeMemeNom', () => {
  it('ignore les majuscules et les espaces autour', () => {
    const elements: Element[] = [{ id: '1', nom: 'Crise', supprime: false }]
    expect(trouverElementDeMemeNom(elements, '  crise ', lireNom)?.id).toBe('1')
  })

  it('renvoie undefined quand aucun nom ne correspond', () => {
    const elements: Element[] = [{ id: '1', nom: 'Crise', supprime: false }]
    expect(trouverElementDeMemeNom(elements, 'Agitation', lireNom)).toBeUndefined()
  })

  it('préfère un élément actif à un élément supprimé', () => {
    const elements: Element[] = [
      { id: 'supprime', nom: 'AB', supprime: true },
      { id: 'actif', nom: 'AB', supprime: false },
    ]
    expect(trouverElementDeMemeNom(elements, 'ab', lireNom)?.id).toBe('actif')
  })

  it('renvoie un élément supprimé s\'il n\'y a que cela', () => {
    const elements: Element[] = [{ id: 'supprime', nom: 'AB', supprime: true }]
    expect(trouverElementDeMemeNom(elements, 'AB', lireNom)?.supprime).toBe(true)
  })
})

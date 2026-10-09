import { describe, expect, it } from 'vitest'
import { fusionnerParIdentifiant } from './fusion'
import type { ElementSynchronisable } from './types'

interface ElementDeTest extends ElementSynchronisable {
  valeur: string
}

describe('fusionnerParIdentifiant', () => {
  it("garde l'union des éléments présents sur un seul appareil", () => {
    const elementsLocaux: ElementDeTest[] = [{ id: 'a', modifieLe: '2026-01-01T10:00:00Z', valeur: 'local' }]
    const elementsDistants: ElementDeTest[] = [{ id: 'b', modifieLe: '2026-01-01T11:00:00Z', valeur: 'distant' }]
    const resultat = fusionnerParIdentifiant(elementsLocaux, elementsDistants)
    expect(resultat.map((element) => element.id).sort()).toEqual(['a', 'b'])
  })

  it('garde la version la plus récente en cas de doublon', () => {
    const elementsLocaux: ElementDeTest[] = [{ id: 'a', modifieLe: '2026-01-01T10:00:00Z', valeur: 'ancien' }]
    const elementsDistants: ElementDeTest[] = [{ id: 'a', modifieLe: '2026-01-02T10:00:00Z', valeur: 'recent' }]
    const resultat = fusionnerParIdentifiant(elementsLocaux, elementsDistants)
    expect(resultat).toHaveLength(1)
    expect(resultat[0].valeur).toBe('recent')
  })

  it('ne remplace pas une version locale plus récente', () => {
    const elementsLocaux: ElementDeTest[] = [{ id: 'a', modifieLe: '2026-02-01T10:00:00Z', valeur: 'recent' }]
    const elementsDistants: ElementDeTest[] = [{ id: 'a', modifieLe: '2026-01-01T10:00:00Z', valeur: 'ancien' }]
    const resultat = fusionnerParIdentifiant(elementsLocaux, elementsDistants)
    expect(resultat[0].valeur).toBe('recent')
  })

  it('est commutative sur le résultat final', () => {
    const premierEnsemble: ElementDeTest[] = [
      { id: 'a', modifieLe: '2026-01-01T10:00:00Z', valeur: 'a1' },
      { id: 'b', modifieLe: '2026-01-03T10:00:00Z', valeur: 'b2' },
    ]
    const secondEnsemble: ElementDeTest[] = [
      { id: 'a', modifieLe: '2026-01-02T10:00:00Z', valeur: 'a2' },
      { id: 'c', modifieLe: '2026-01-01T10:00:00Z', valeur: 'c1' },
    ]
    const resultatAB = fusionnerParIdentifiant(premierEnsemble, secondEnsemble)
    const resultatBA = fusionnerParIdentifiant(secondEnsemble, premierEnsemble)
    const normaliser = (elements: ElementDeTest[]) =>
      [...elements].sort((elementA, elementB) => elementA.id.localeCompare(elementB.id))
    expect(normaliser(resultatAB)).toEqual(normaliser(resultatBA))
  })

  it("propage une suppression logique plus récente", () => {
    const elementsLocaux: Array<ElementDeTest & { supprime: boolean }> = [
      { id: 'a', modifieLe: '2026-01-01T10:00:00Z', valeur: 'x', supprime: false },
    ]
    const elementsDistants: Array<ElementDeTest & { supprime: boolean }> = [
      { id: 'a', modifieLe: '2026-01-05T10:00:00Z', valeur: 'x', supprime: true },
    ]
    const resultat = fusionnerParIdentifiant(elementsLocaux, elementsDistants)
    expect(resultat[0].supprime).toBe(true)
  })
})

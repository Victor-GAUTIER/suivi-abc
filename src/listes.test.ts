import { describe, expect, it } from 'vitest'
import { extraireListesConnues } from './listes'
import type { EntreeABC } from './types'

function creerEntreeDeTest(modifications: Partial<EntreeABC>): EntreeABC {
  return {
    id: 'e1',
    profilId: 'p1',
    dateHeure: '2026-10-09T08:30',
    typeId: 't1',
    antecedents: 'a',
    comportement: 'b',
    consequences: 'c',
    lieu: '',
    personnesPresentes: [],
    intensite: null,
    dureeMinutes: null,
    fonctionHypothetique: null,
    auteur: '',
    modifieLe: '2026-10-09T10:00:00Z',
    supprime: false,
    ...modifications,
  }
}

describe('extraireListesConnues', () => {
  it('déduit les lieux, personnes et auteurs des entrées, triés', () => {
    const entrees = [
      creerEntreeDeTest({ id: '1', lieu: 'Salle', personnesPresentes: ['Maman', 'Éducatrice'], auteur: 'Parent' }),
      creerEntreeDeTest({ id: '2', lieu: 'Cantine', personnesPresentes: ['Papa'], auteur: 'Éducatrice' }),
    ]
    const listes = extraireListesConnues(entrees, '')
    expect(listes.lieux).toEqual(['Cantine', 'Salle'])
    expect(listes.personnes).toEqual(['Éducatrice', 'Maman', 'Papa'])
    expect(listes.auteurs).toEqual(['Éducatrice', 'Parent'])
  })

  it('ignore les valeurs vides et les doublons de casse', () => {
    const entrees = [
      creerEntreeDeTest({ id: '1', lieu: 'Salle', personnesPresentes: ['Maman', ' '] }),
      creerEntreeDeTest({ id: '2', lieu: 'salle ', personnesPresentes: ['maman'] }),
      creerEntreeDeTest({ id: '3', lieu: '' }),
    ]
    const listes = extraireListesConnues(entrees, '')
    expect(listes.lieux).toEqual(['Salle'])
    expect(listes.personnes).toEqual(['Maman'])
  })

  it('ignore les entrées supprimées', () => {
    const entrees = [
      creerEntreeDeTest({ id: '1', lieu: 'Salle' }),
      creerEntreeDeTest({ id: '2', lieu: 'Jardin', supprime: true }),
    ]
    expect(extraireListesConnues(entrees, '').lieux).toEqual(['Salle'])
  })

  it("ajoute l'auteur par défaut même sans entrée", () => {
    expect(extraireListesConnues([], 'Victor').auteurs).toEqual(['Victor'])
  })
})

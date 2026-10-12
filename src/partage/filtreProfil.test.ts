import { describe, expect, it } from 'vitest'
import type { EntreeABC, Profil, Sauvegarde } from '../types'
import { extraireSauvegardeDuProfil } from './filtreProfil'

function profil(id: string): Profil {
  return { id, code: id, modifieLe: '2026-01-01T00:00:00.000Z', supprime: false }
}

function entree(id: string, profilId: string): EntreeABC {
  return {
    id,
    profilId,
    modifieLe: '2026-01-01T00:00:00.000Z',
    dateHeure: '2026-01-01T10:00',
    typeId: 't1',
    antecedents: '',
    comportement: '',
    consequences: '',
    lieu: '',
    personnesPresentes: [],
    intensite: null,
    dureeMinutes: null,
    fonctionHypothetique: null,
    auteur: '',
    supprime: false,
  }
}

const sauvegarde: Sauvegarde = {
  version: 1,
  exporteLe: '2026-01-01T00:00:00.000Z',
  profils: [profil('A'), profil('B')],
  typesComportement: [{ id: 't1', nom: 'Crise', couleur: '#fff', modifieLe: '2026-01-01T00:00:00.000Z', supprime: false }],
  entrees: [entree('e1', 'A'), entree('e2', 'B'), entree('e3', 'A')],
}

describe('extraireSauvegardeDuProfil', () => {
  it('garde uniquement le profil demandé et ses saisies', () => {
    const resultat = extraireSauvegardeDuProfil(sauvegarde, 'A')
    expect(resultat.profils.map((p) => p.id)).toEqual(['A'])
    expect(resultat.entrees.map((e) => e.id)).toEqual(['e1', 'e3'])
  })

  it('garde les types de comportement communs', () => {
    const resultat = extraireSauvegardeDuProfil(sauvegarde, 'B')
    expect(resultat.typesComportement).toHaveLength(1)
    expect(resultat.entrees.map((e) => e.id)).toEqual(['e2'])
  })

  it("renvoie des listes vides pour un profil inconnu", () => {
    const resultat = extraireSauvegardeDuProfil(sauvegarde, 'Z')
    expect(resultat.profils).toEqual([])
    expect(resultat.entrees).toEqual([])
  })
})

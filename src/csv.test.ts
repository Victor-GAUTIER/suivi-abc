import { describe, expect, it } from 'vitest'
import { construireCSV } from './csv'
import { compterParHeure, decouperListeTexte } from './statistiques'
import type { EntreeABC, Profil, TypeComportement } from './types'

const profils: Profil[] = [{ id: 'p1', code: 'AB', modifieLe: '2026-01-01T00:00:00Z', supprime: false }]
const types: TypeComportement[] = [
  { id: 't1', nom: 'Crise', couleur: '#ef4444', modifieLe: '2026-01-01T00:00:00Z', supprime: false },
]

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

describe('construireCSV', () => {
  it('commence par un BOM et une ligne d\'en-têtes', () => {
    const contenu = construireCSV([], profils, types)
    expect(contenu.startsWith('﻿Profil;Date et heure;Type')).toBe(true)
  })

  it('protège les points-virgules, guillemets et retours à la ligne', () => {
    const entree = creerEntreeDeTest({ comportement: 'dit "non"; puis\nsort' })
    const contenu = construireCSV([entree], profils, types)
    expect(contenu).toContain('"dit ""non""; puis\nsort"')
  })

  it('remplace les identifiants par le code du profil et le nom du type', () => {
    const contenu = construireCSV([creerEntreeDeTest({})], profils, types)
    expect(contenu).toContain('AB;2026-10-09 08:30;Crise')
  })

  it('traduit la fonction hypothétique en français', () => {
    const entree = creerEntreeDeTest({ fonctionHypothetique: 'acces_objet' })
    const contenu = construireCSV([entree], profils, types)
    expect(contenu).toContain('Accès à un objet ou une activité')
  })
})

describe('statistiques', () => {
  it('compte les entrées par heure', () => {
    const entrees = [
      creerEntreeDeTest({ id: '1', dateHeure: '2026-10-09T08:10' }),
      creerEntreeDeTest({ id: '2', dateHeure: '2026-10-10T08:50' }),
      creerEntreeDeTest({ id: '3', dateHeure: '2026-10-10T23:05' }),
    ]
    const comptes = compterParHeure(entrees)
    expect(comptes[8]).toBe(2)
    expect(comptes[23]).toBe(1)
    expect(comptes.reduce((somme, nombre) => somme + nombre, 0)).toBe(3)
  })

  it('découpe une liste saisie à la main', () => {
    expect(decouperListeTexte(' Maman, Papa ;  ,Éducateur ')).toEqual(['Maman', 'Papa', 'Éducateur'])
  })
})

import { describe, expect, it } from 'vitest'
import type { EtatPartage } from './partage/gestionnairePartage'
import type { EtatSynchro } from './synchro/gestionnaire'
import { calculerEtatGlobal } from './etatGlobal'

const personnelInactif: EtatSynchro = { statut: 'inactive', messageErreur: '', derniereSynchroLe: null }
const aucunPartage: EtatPartage = {
  configurations: [],
  parProfil: {},
  messageReprise: '',
  erreurReprise: '',
  profilRejointId: '',
}

function partageAvec(profils: Record<string, { statut: 'repos' | 'en_cours' | 'reconnexion_necessaire' | 'erreur'; derniereSynchroLe: string | null; messageErreur?: string }>): EtatPartage {
  return {
    ...aucunPartage,
    configurations: Object.keys(profils).map((profilId) => ({ profilId, identifiantFichier: 'f-' + profilId, motDePasse: 'x' })),
    parProfil: Object.fromEntries(
      Object.entries(profils).map(([id, p]) => [id, { messageErreur: '', ...p }]),
    ),
  }
}

describe('calculerEtatGlobal', () => {
  it("n'est pas actif sans synchronisation ni profil partagé", () => {
    expect(calculerEtatGlobal(personnelInactif, aucunPartage).actif).toBe(false)
  })

  it('est actif avec la seule synchronisation personnelle', () => {
    const etat = calculerEtatGlobal(
      { statut: 'repos', messageErreur: '', derniereSynchroLe: '2026-11-13T10:00:00.000Z' },
      aucunPartage,
    )
    expect(etat).toMatchObject({ actif: true, statut: 'repos', derniereSynchroLe: '2026-11-13T10:00:00.000Z' })
  })

  it('est actif avec seulement des profils partagés', () => {
    const etat = calculerEtatGlobal(personnelInactif, partageAvec({ a: { statut: 'repos', derniereSynchroLe: '2026-11-13T09:00:00.000Z' } }))
    expect(etat).toMatchObject({ actif: true, statut: 'repos' })
  })

  it('garde la date la plus ancienne', () => {
    const etat = calculerEtatGlobal(
      { statut: 'repos', messageErreur: '', derniereSynchroLe: '2026-11-13T10:00:00.000Z' },
      partageAvec({ a: { statut: 'repos', derniereSynchroLe: '2026-11-12T08:00:00.000Z' } }),
    )
    expect(etat.derniereSynchroLe).toBe('2026-11-12T08:00:00.000Z')
  })

  it("indique « jamais » (null) si l'une des synchronisations n'a jamais eu lieu", () => {
    const etat = calculerEtatGlobal(
      { statut: 'repos', messageErreur: '', derniereSynchroLe: '2026-11-13T10:00:00.000Z' },
      partageAvec({ a: { statut: 'repos', derniereSynchroLe: null } }),
    )
    expect(etat.derniereSynchroLe).toBeNull()
  })

  it('retient le statut le plus urgent : en cours > reconnexion > erreur > repos', () => {
    const base = { statut: 'repos' as const, messageErreur: '', derniereSynchroLe: '2026-11-13T10:00:00.000Z' }
    expect(calculerEtatGlobal(base, partageAvec({ a: { statut: 'erreur', derniereSynchroLe: null, messageErreur: 'x' } })).statut).toBe('erreur')
    expect(
      calculerEtatGlobal(
        { ...base, statut: 'erreur', messageErreur: 'y' },
        partageAvec({ a: { statut: 'reconnexion_necessaire', derniereSynchroLe: null } }),
      ).statut,
    ).toBe('reconnexion_necessaire')
    expect(
      calculerEtatGlobal(
        { ...base, statut: 'reconnexion_necessaire' },
        partageAvec({ a: { statut: 'en_cours', derniereSynchroLe: null } }),
      ).statut,
    ).toBe('en_cours')
  })

  it('regroupe les messages d\'erreur sans doublon', () => {
    const etat = calculerEtatGlobal(
      { statut: 'erreur', messageErreur: 'Hors ligne', derniereSynchroLe: null },
      partageAvec({
        a: { statut: 'erreur', derniereSynchroLe: null, messageErreur: 'Hors ligne' },
        b: { statut: 'erreur', derniereSynchroLe: null, messageErreur: 'Accès retiré' },
      }),
    )
    expect(etat.messagesErreur).toEqual(['Hors ligne', 'Accès retiré'])
  })
})

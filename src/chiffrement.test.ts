import { describe, expect, it } from 'vitest'
import { chiffrerTexte, dechiffrerTexte, estEnveloppeChiffree } from './chiffrement'
import { dechiffrerSauvegarde, lireContenuFichier, serialiserSauvegarde } from './sauvegarde'
import type { Sauvegarde } from './types'

const sauvegardeDeTest: Sauvegarde = {
  version: 1,
  exporteLe: '2026-10-09T12:00:00.000Z',
  profils: [{ id: 'p1', code: 'AB', modifieLe: '2026-10-09T12:00:00.000Z', supprime: false }],
  typesComportement: [
    { id: 't1', nom: 'Crise', couleur: '#ef4444', modifieLe: '2026-10-09T12:00:00.000Z', supprime: false },
  ],
  entrees: [
    {
      id: 'e1',
      profilId: 'p1',
      dateHeure: '2026-10-09T08:30',
      typeId: 't1',
      antecedents: 'Consigne donnée',
      comportement: 'Cris',
      consequences: 'Pause accordée',
      lieu: 'Salle de classe',
      personnesPresentes: ['Éducatrice'],
      intensite: 3,
      dureeMinutes: 5,
      fonctionHypothetique: 'evitement',
      auteur: 'Parent',
      modifieLe: '2026-10-09T12:00:00.000Z',
      supprime: false,
    },
  ],
}

describe('chiffrement', () => {
  it('déchiffre ce qui a été chiffré avec le même mot de passe', async () => {
    const enveloppe = await chiffrerTexte('texte secret éàç', 'motdepasse')
    const texteRetrouve = await dechiffrerTexte(enveloppe, 'motdepasse')
    expect(texteRetrouve).toBe('texte secret éàç')
  })

  it('refuse un mauvais mot de passe', async () => {
    const enveloppe = await chiffrerTexte('texte secret', 'bon')
    await expect(dechiffrerTexte(enveloppe, 'mauvais')).rejects.toThrow('Mot de passe incorrect')
  })

  it('produit un contenu différent à chaque chiffrement', async () => {
    const premiere = await chiffrerTexte('même texte', 'motdepasse')
    const seconde = await chiffrerTexte('même texte', 'motdepasse')
    expect(premiere.donnees).not.toBe(seconde.donnees)
    expect(premiere.sel).not.toBe(seconde.sel)
  })

  it('ne laisse pas le texte clair visible dans le fichier chiffré', async () => {
    const contenu = await serialiserSauvegarde(sauvegardeDeTest, 'motdepasse')
    expect(contenu).not.toContain('Cris')
    expect(contenu).not.toContain('Salle de classe')
  })

  it('reconnaît une enveloppe chiffrée', async () => {
    const enveloppe = await chiffrerTexte('x', 'y')
    expect(estEnveloppeChiffree(enveloppe)).toBe(true)
    expect(estEnveloppeChiffree({ version: 1 })).toBe(false)
  })
})

describe('sauvegarde', () => {
  it('fait un aller-retour chiffré complet', async () => {
    const contenu = await serialiserSauvegarde(sauvegardeDeTest, 'motdepasse')
    const contenuLu = lireContenuFichier(contenu)
    expect(contenuLu.type).toBe('chiffre')
    if (contenuLu.type === 'chiffre') {
      const sauvegardeRetrouvee = await dechiffrerSauvegarde(contenuLu.enveloppe, 'motdepasse')
      expect(sauvegardeRetrouvee).toEqual(sauvegardeDeTest)
    }
  })

  it('fait un aller-retour en clair', async () => {
    const contenu = await serialiserSauvegarde(sauvegardeDeTest, null)
    const contenuLu = lireContenuFichier(contenu)
    expect(contenuLu.type).toBe('clair')
    if (contenuLu.type === 'clair') {
      expect(contenuLu.sauvegarde).toEqual(sauvegardeDeTest)
    }
  })

  it('rejette un JSON qui n\'est pas une sauvegarde', () => {
    expect(() => lireContenuFichier('{"a":1}')).toThrow('pas une sauvegarde valide')
    expect(() => lireContenuFichier('pas du json')).toThrow('pas un JSON valide')
  })

  it('rejette des éléments sans identifiant', () => {
    const invalide = JSON.stringify({
      version: 1,
      exporteLe: 'x',
      profils: [{ code: 'AB' }],
      typesComportement: [],
      entrees: [],
    })
    expect(() => lireContenuFichier(invalide)).toThrow('sans identifiant')
  })
})

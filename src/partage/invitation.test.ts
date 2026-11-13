import { describe, expect, it } from 'vitest'
import {
  analyserInvitation,
  analyserInvitationMemorisee,
  construireLienInvitation,
} from './invitation'

const IDENTIFIANT = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-012'

describe('construireLienInvitation', () => {
  it("garde le dossier du site et n'ajoute que le fichier et le code", () => {
    const lien = construireLienInvitation('https://site.test/suivi-abc/?ancien=1#x', IDENTIFIANT, 'AB')
    const adresse = new URL(lien)
    expect(adresse.origin + adresse.pathname).toBe('https://site.test/suivi-abc/')
    expect(adresse.searchParams.get('rejoindre')).toBe(IDENTIFIANT)
    expect(adresse.searchParams.get('profil')).toBe('AB')
    expect(adresse.searchParams.get('ancien')).toBeNull()
    expect(adresse.hash).toBe('')
  })

  it('encode un code avec espaces et accents', () => {
    const lien = construireLienInvitation('https://site.test/', IDENTIFIANT, 'Léa B.')
    expect(analyserInvitation(new URL(lien).search)?.codeProfil).toBe('Léa B.')
  })
})

describe('analyserInvitation', () => {
  it('lit le fichier et le code', () => {
    expect(analyserInvitation(`?rejoindre=${IDENTIFIANT}&profil=AB`)).toEqual({
      identifiantFichier: IDENTIFIANT,
      codeProfil: 'AB',
      motDePasse: null,
    })
  })

  it('accepte une invitation sans code', () => {
    expect(analyserInvitation(`?rejoindre=${IDENTIFIANT}`)?.codeProfil).toBe('')
  })

  it('refuse une adresse sans invitation ou avec un identifiant suspect', () => {
    expect(analyserInvitation('')).toBeNull()
    expect(analyserInvitation('?profil=AB')).toBeNull()
    expect(analyserInvitation('?rejoindre=court')).toBeNull()
    expect(analyserInvitation('?rejoindre=../../evil/chemin/trop/long/etrange')).toBeNull()
  })
})

describe('analyserInvitationMemorisee', () => {
  it('relit une invitation valide', () => {
    const brut = JSON.stringify({ identifiantFichier: IDENTIFIANT, codeProfil: 'AB' })
    expect(analyserInvitationMemorisee(brut)).toEqual({
      identifiantFichier: IDENTIFIANT,
      codeProfil: 'AB',
      motDePasse: null,
    })
  })

  it('ignore une valeur absente, illisible ou invalide', () => {
    expect(analyserInvitationMemorisee(null)).toBeNull()
    expect(analyserInvitationMemorisee('pas du json')).toBeNull()
    expect(analyserInvitationMemorisee(JSON.stringify({ identifiantFichier: 'x' }))).toBeNull()
  })
})

describe('mot de passe dans le lien', () => {
  it('le place dans le fragment, jamais dans la requête', () => {
    const lien = construireLienInvitation('https://site.test/app/', IDENTIFIANT, 'AB', 'mot de passe & co/é')
    const adresse = new URL(lien)
    expect(adresse.search).not.toContain('mot')
    expect(adresse.hash.startsWith('#mdp=')).toBe(true)
    expect(analyserInvitation(adresse.search, adresse.hash)?.motDePasse).toBe('mot de passe & co/é')
  })

  it("n'ajoute aucun fragment sans mot de passe", () => {
    expect(new URL(construireLienInvitation('https://site.test/', IDENTIFIANT, 'AB')).hash).toBe('')
    expect(new URL(construireLienInvitation('https://site.test/', IDENTIFIANT, 'AB', '')).hash).toBe('')
  })

  it('ignore un mot de passe démesuré', () => {
    expect(analyserInvitation(`?rejoindre=${IDENTIFIANT}`, `#mdp=${'x'.repeat(500)}`)?.motDePasse).toBeNull()
  })

  it('relit un mot de passe mémorisé', () => {
    const brut = JSON.stringify({ identifiantFichier: IDENTIFIANT, codeProfil: 'AB', motDePasse: 'secret' })
    expect(analyserInvitationMemorisee(brut)?.motDePasse).toBe('secret')
  })
})

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
    expect(analyserInvitationMemorisee(brut)).toEqual({ identifiantFichier: IDENTIFIANT, codeProfil: 'AB' })
  })

  it('ignore une valeur absente, illisible ou invalide', () => {
    expect(analyserInvitationMemorisee(null)).toBeNull()
    expect(analyserInvitationMemorisee('pas du json')).toBeNull()
    expect(analyserInvitationMemorisee(JSON.stringify({ identifiantFichier: 'x' }))).toBeNull()
  })
})

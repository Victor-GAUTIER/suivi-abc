import { describe, expect, it } from 'vitest'
import {
  adresseDeRetour,
  analyserRetourRedirection,
  construireUrlConnexionGoogle,
  navigateurNecessiteRedirection,
} from './redirectionGoogle'

describe('navigateurNecessiteRedirection', () => {
  it('détecte un iPhone', () => {
    expect(navigateurNecessiteRedirection('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', 'iPhone', 5, '')).toBe(true)
  })

  it('détecte un iPad qui se présente comme un Mac', () => {
    expect(navigateurNecessiteRedirection('Mozilla/5.0 (Macintosh)', 'MacIntel', 5, '')).toBe(true)
  })

  it('laisse un vrai Mac utiliser la popup', () => {
    expect(navigateurNecessiteRedirection('Mozilla/5.0 (Macintosh)', 'MacIntel', 0, '')).toBe(false)
  })

  it('laisse Android utiliser la popup', () => {
    expect(navigateurNecessiteRedirection('Mozilla/5.0 (Linux; Android 14)', 'Linux armv81', 5, '')).toBe(false)
  })

  it('accepte le forçage par ?connexion=redirection', () => {
    expect(navigateurNecessiteRedirection('Mozilla/5.0 (Windows)', 'Win32', 0, '?connexion=redirection')).toBe(true)
  })
})

describe('adresseDeRetour', () => {
  it('garde le dossier du site et retire index.html', () => {
    expect(adresseDeRetour('https://victor-gautier.github.io', '/suivi-abc/index.html')).toBe(
      'https://victor-gautier.github.io/suivi-abc/',
    )
    expect(adresseDeRetour('https://victor-gautier.github.io', '/suivi-abc/')).toBe(
      'https://victor-gautier.github.io/suivi-abc/',
    )
  })
})

describe('construireUrlConnexionGoogle', () => {
  it('contient les paramètres attendus par Google', () => {
    const adresse = new URL(
      construireUrlConnexionGoogle('id-client', 'https://site.test/app/', 'scope-a scope-b', 'etat-1'),
    )
    expect(adresse.origin + adresse.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(adresse.searchParams.get('client_id')).toBe('id-client')
    expect(adresse.searchParams.get('redirect_uri')).toBe('https://site.test/app/')
    expect(adresse.searchParams.get('response_type')).toBe('token')
    expect(adresse.searchParams.get('scope')).toBe('scope-a scope-b')
    expect(adresse.searchParams.get('state')).toBe('etat-1')
  })
})

describe('analyserRetourRedirection', () => {
  it('lit le jeton et sa durée', () => {
    const retour = analyserRetourRedirection('#access_token=abc&expires_in=3599&state=e1', '', 'e1')
    expect(retour).toEqual({ type: 'jeton', jeton: 'abc', dureeSecondes: 3599 })
  })

  it('ignore une page sans état attendu', () => {
    expect(analyserRetourRedirection('#access_token=abc&state=e1', '', null)).toEqual({ type: 'aucun' })
  })

  it('ignore un état qui ne correspond pas', () => {
    expect(analyserRetourRedirection('#access_token=abc&state=autre', '', 'e1')).toEqual({ type: 'aucun' })
  })

  it('ignore une page normale', () => {
    expect(analyserRetourRedirection('', '', 'e1')).toEqual({ type: 'aucun' })
  })

  it("lit une erreur dans la requête ou dans le fragment", () => {
    expect(analyserRetourRedirection('', '?error=access_denied&state=e1', 'e1')).toEqual({
      type: 'erreur',
      message: 'access_denied',
    })
    expect(analyserRetourRedirection('#error=access_denied&state=e1', '', 'e1')).toEqual({
      type: 'erreur',
      message: 'access_denied',
    })
  })

  it('signale une réponse sans jeton', () => {
    expect(analyserRetourRedirection('#state=e1', '', 'e1')).toEqual({ type: 'erreur', message: 'pas de jeton' })
  })

  it('remplace une durée invalide par une heure', () => {
    const retour = analyserRetourRedirection('#access_token=abc&expires_in=oups&state=e1', '', 'e1')
    expect(retour).toEqual({ type: 'jeton', jeton: 'abc', dureeSecondes: 3600 })
  })
})

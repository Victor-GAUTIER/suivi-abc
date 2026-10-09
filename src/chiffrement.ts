import type { EnveloppeChiffree } from './types'

const NOMBRE_ITERATIONS_PBKDF2 = 310_000
const TAILLE_SEL_OCTETS = 16
const TAILLE_VECTEUR_OCTETS = 12

function octetsVersBase64(octets: Uint8Array): string {
  let chaineBinaire = ''
  for (const octet of octets) {
    chaineBinaire += String.fromCharCode(octet)
  }
  return btoa(chaineBinaire)
}

function base64VersOctets(texteBase64: string): Uint8Array<ArrayBuffer> {
  const chaineBinaire = atob(texteBase64)
  const octets = new Uint8Array(chaineBinaire.length)
  for (let position = 0; position < chaineBinaire.length; position += 1) {
    octets[position] = chaineBinaire.charCodeAt(position)
  }
  return octets
}

async function deriverCle(motDePasse: string, sel: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const materielCle = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(motDePasse),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations: NOMBRE_ITERATIONS_PBKDF2, hash: 'SHA-256' },
    materielCle,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function chiffrerTexte(
  texteClair: string,
  motDePasse: string,
): Promise<EnveloppeChiffree> {
  const sel = crypto.getRandomValues(new Uint8Array(TAILLE_SEL_OCTETS))
  const vecteurInitialisation = crypto.getRandomValues(new Uint8Array(TAILLE_VECTEUR_OCTETS))
  const cle = await deriverCle(motDePasse, sel)
  const donneesChiffrees = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: vecteurInitialisation },
    cle,
    new TextEncoder().encode(texteClair),
  )
  return {
    version: 1,
    chiffre: true,
    sel: octetsVersBase64(sel),
    vecteurInitialisation: octetsVersBase64(vecteurInitialisation),
    donnees: octetsVersBase64(new Uint8Array(donneesChiffrees)),
  }
}

export async function dechiffrerTexte(
  enveloppe: EnveloppeChiffree,
  motDePasse: string,
): Promise<string> {
  const sel = base64VersOctets(enveloppe.sel)
  const vecteurInitialisation = base64VersOctets(enveloppe.vecteurInitialisation)
  const cle = await deriverCle(motDePasse, sel)
  try {
    const donneesClaires = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: vecteurInitialisation },
      cle,
      base64VersOctets(enveloppe.donnees),
    )
    return new TextDecoder().decode(donneesClaires)
  } catch {
    throw new Error('Mot de passe incorrect ou fichier corrompu.')
  }
}

export function estEnveloppeChiffree(valeur: unknown): valeur is EnveloppeChiffree {
  if (typeof valeur !== 'object' || valeur === null) {
    return false
  }
  const candidat = valeur as Record<string, unknown>
  return (
    candidat.chiffre === true &&
    typeof candidat.sel === 'string' &&
    typeof candidat.vecteurInitialisation === 'string' &&
    typeof candidat.donnees === 'string'
  )
}

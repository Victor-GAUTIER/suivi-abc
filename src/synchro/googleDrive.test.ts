import { describe, expect, it } from 'vitest'
import { creerFichierDrive, listerFichiersProfils, StockageFichierDrive } from './googleDrive'
import { ErreurAuthentificationGoogle } from './types'

interface AppelEnregistre {
  url: string
  methode: string
  autorisation: string | null
  corps: string | null
}

// Faux Google Drive : quelques fichiers en mémoire, avec les mêmes routes que la vraie API.
function creerFauxDrive(options: { statutForce?: number } = {}) {
  const appels: AppelEnregistre[] = []
  const fichiers = new Map<string, { nom: string; contenu: string }>()

  const appelerReseau: typeof fetch = async (entree, init) => {
    const url = String(entree)
    const methode = init?.method ?? 'GET'
    const enTetes = new Headers(init?.headers)
    const corps = typeof init?.body === 'string' ? init.body : null
    appels.push({ url, methode, autorisation: enTetes.get('Authorization'), corps })

    if (options.statutForce !== undefined) {
      return new Response('{}', { status: options.statutForce })
    }
    if (methode === 'GET' && url.includes('/drive/v3/files?')) {
      const liste = [...fichiers.entries()].map(([id, fichier]) => ({ id, name: fichier.nom }))
      return new Response(JSON.stringify({ files: liste }), { status: 200 })
    }
    if (methode === 'GET' && url.includes('alt=media')) {
      const id = url.split('/files/')[1].split('?')[0]
      const fichier = fichiers.get(id)
      return fichier === undefined
        ? new Response('{}', { status: 404 })
        : new Response(fichier.contenu, { status: 200 })
    }
    if (methode === 'POST' && url.includes('uploadType=multipart')) {
      const nom = /"name":"([^"]*)"/.exec(corps ?? '')?.[1] ?? ''
      const contenu = (corps ?? '').split('Content-Type: application/json\r\n\r\n')[1]?.split('\r\n--')[0] ?? ''
      const id = `fichier-test-${fichiers.size + 1}`
      fichiers.set(id, { nom, contenu })
      return new Response(JSON.stringify({ id }), { status: 200 })
    }
    if (methode === 'PATCH' && url.includes('uploadType=media')) {
      const id = url.split('/files/')[1].split('?')[0]
      const fichier = fichiers.get(id)
      if (fichier !== undefined) {
        fichier.contenu = corps ?? ''
      }
      return new Response(JSON.stringify({ id }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  }

  return { appels, appelerReseau, fichiers }
}

describe('fichiers de profil dans Drive', () => {
  it('crée un fichier, le relit et le met à jour', async () => {
    const drive = creerFauxDrive()
    const identifiant = await creerFichierDrive(
      'Suivi ABC - profil AB.json',
      '{"premier":"envoi é"}',
      async () => 'jeton',
      drive.appelerReseau,
    )
    const stockage = new StockageFichierDrive(identifiant, async () => 'jeton', drive.appelerReseau)
    expect(await stockage.lire()).toBe('{"premier":"envoi é"}')

    await stockage.ecrire('{"second":"envoi"}')
    expect(await stockage.lire()).toBe('{"second":"envoi"}')
    expect(drive.appels.some((appel) => appel.methode === 'PATCH')).toBe(true)
  })

  it('liste les fichiers de profil par leur nom', async () => {
    const drive = creerFauxDrive()
    await creerFichierDrive('Suivi ABC - profil AB.json', '{}', async () => 'jeton', drive.appelerReseau)
    const fichiers = await listerFichiersProfils(async () => 'jeton', drive.appelerReseau)
    expect(fichiers).toEqual([{ identifiant: 'fichier-test-1', nom: 'Suivi ABC - profil AB.json' }])
    const appelListe = drive.appels.find((appel) => appel.methode === 'GET')
    expect(decodeURIComponent(appelListe?.url ?? '')).toContain("name contains 'Suivi ABC - profil'")
  })

  it("envoie le jeton dans l'en-tête Authorization", async () => {
    const drive = creerFauxDrive()
    await listerFichiersProfils(async () => 'mon-jeton', drive.appelerReseau)
    expect(drive.appels[0].autorisation).toBe('Bearer mon-jeton')
  })

  it('signale une connexion expirée quand Google répond 401', async () => {
    const drive = creerFauxDrive({ statutForce: 401 })
    await expect(listerFichiersProfils(async () => 'jeton', drive.appelerReseau)).rejects.toBeInstanceOf(
      ErreurAuthentificationGoogle,
    )
  })

  it('signale les autres erreurs avec le code reçu', async () => {
    const drive = creerFauxDrive({ statutForce: 500 })
    await expect(listerFichiersProfils(async () => 'jeton', drive.appelerReseau)).rejects.toThrow('500')
  })
})

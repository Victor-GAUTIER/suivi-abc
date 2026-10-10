import { describe, expect, it } from 'vitest'
import { StockageGoogleDrive } from './googleDrive'
import { ErreurAuthentificationGoogle } from './types'

interface AppelEnregistre {
  url: string
  methode: string
  autorisation: string | null
  corps: string | null
}

// Faux Google Drive : un seul fichier en mémoire, avec les mêmes routes que la vraie API.
function creerFauxDrive(options: { statutForce?: number } = {}) {
  const appels: AppelEnregistre[] = []
  let contenuFichier: string | null = null

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
      const fichiers = contenuFichier === null ? [] : [{ id: 'fichier-1' }]
      return new Response(JSON.stringify({ files: fichiers }), { status: 200 })
    }
    if (methode === 'GET' && url.includes('alt=media')) {
      return new Response(contenuFichier ?? '', { status: 200 })
    }
    if (methode === 'POST' && url.includes('uploadType=multipart')) {
      const partieContenu = corps?.split('Content-Type: application/json\r\n\r\n')[1]
      contenuFichier = partieContenu?.split('\r\n--')[0] ?? ''
      return new Response(JSON.stringify({ id: 'fichier-1' }), { status: 200 })
    }
    if (methode === 'PATCH' && url.includes('uploadType=media')) {
      contenuFichier = corps
      return new Response(JSON.stringify({ id: 'fichier-1' }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  }

  return { appels, appelerReseau, lireContenu: () => contenuFichier }
}

describe('StockageGoogleDrive', () => {
  it("renvoie null quand le fichier n'existe pas encore", async () => {
    const drive = creerFauxDrive()
    const stockage = new StockageGoogleDrive(async () => 'jeton', drive.appelerReseau)
    expect(await stockage.lire()).toBeNull()
  })

  it('crée le fichier dans le dossier caché, puis le met à jour et le relit', async () => {
    const drive = creerFauxDrive()
    const stockage = new StockageGoogleDrive(async () => 'jeton', drive.appelerReseau)

    await stockage.ecrire('{"premier":"envoi é"}')
    expect(drive.lireContenu()).toBe('{"premier":"envoi é"}')
    const appelCreation = drive.appels.find((appel) => appel.methode === 'POST')
    expect(appelCreation?.corps).toContain('"parents":["appDataFolder"]')

    await stockage.ecrire('{"second":"envoi"}')
    expect(drive.lireContenu()).toBe('{"second":"envoi"}')
    expect(drive.appels.some((appel) => appel.methode === 'PATCH')).toBe(true)
    expect(await stockage.lire()).toBe('{"second":"envoi"}')
  })

  it("cherche uniquement dans l'espace appDataFolder", async () => {
    const drive = creerFauxDrive()
    const stockage = new StockageGoogleDrive(async () => 'jeton', drive.appelerReseau)
    await stockage.lire()
    expect(drive.appels[0].url).toContain('spaces=appDataFolder')
  })

  it('demande le tri par date de création et utilise le premier fichier renvoyé', async () => {
    const appels: string[] = []
    const appelerReseau: typeof fetch = async (entree) => {
      const url = String(entree)
      appels.push(url)
      if (url.includes('/drive/v3/files?')) {
        const deuxFichiers = [{ id: 'le-plus-ancien' }, { id: 'le-plus-recent' }]
        return new Response(JSON.stringify({ files: deuxFichiers }), { status: 200 })
      }
      return new Response('contenu', { status: 200 })
    }
    const stockage = new StockageGoogleDrive(async () => 'jeton', appelerReseau)
    await stockage.lire()
    expect(appels[0]).toContain('orderBy=createdTime')
    expect(appels[1]).toContain('/files/le-plus-ancien?alt=media')
  })

  it('envoie le jeton dans l\'en-tête Authorization', async () => {
    const drive = creerFauxDrive()
    const stockage = new StockageGoogleDrive(async () => 'mon-jeton', drive.appelerReseau)
    await stockage.lire()
    expect(drive.appels[0].autorisation).toBe('Bearer mon-jeton')
  })

  it('signale une connexion expirée quand Google répond 401', async () => {
    const drive = creerFauxDrive({ statutForce: 401 })
    const stockage = new StockageGoogleDrive(async () => 'jeton', drive.appelerReseau)
    await expect(stockage.lire()).rejects.toBeInstanceOf(ErreurAuthentificationGoogle)
  })

  it('signale les autres erreurs avec le code reçu', async () => {
    const drive = creerFauxDrive({ statutForce: 500 })
    const stockage = new StockageGoogleDrive(async () => 'jeton', drive.appelerReseau)
    await expect(stockage.lire()).rejects.toThrow('500')
  })
})

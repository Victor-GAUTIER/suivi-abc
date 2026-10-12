import { describe, expect, it } from 'vitest'
import { creerFichierDrive, StockageFichierDrive } from '../synchro/googleDrive'
import { ErreurAccesFichierDrive, ErreurAuthentificationGoogle } from '../synchro/types'
import {
  inviterPersonne,
  listerPersonnesAvecAcces,
  lireDroitsSurFichier,
  retirerAcces,
} from './permissions'

interface Appel {
  url: string
  methode: string
  corps: string | null
}

function creerReseau(reponse: (appel: Appel) => Response) {
  const appels: Appel[] = []
  const reseau: typeof fetch = async (entree, init) => {
    const appel: Appel = {
      url: String(entree),
      methode: init?.method ?? 'GET',
      corps: typeof init?.body === 'string' ? init.body : null,
    }
    appels.push(appel)
    return reponse(appel)
  }
  return { appels, reseau }
}

const jeton = async () => 'jeton'

describe('permissions Drive', () => {
  it("liste uniquement les personnes (pas les liens publics)", async () => {
    const { reseau } = creerReseau(
      () =>
        new Response(
          JSON.stringify({
            permissions: [
              { id: 'p1', type: 'user', role: 'owner', emailAddress: 'moi@exemple.fr', displayName: 'Moi' },
              { id: 'p2', type: 'user', role: 'writer', emailAddress: 'tante@exemple.fr' },
              { id: 'p3', type: 'anyone', role: 'reader' },
            ],
          }),
          { status: 200 },
        ),
    )
    const personnes = await listerPersonnesAvecAcces('f1', jeton, reseau)
    expect(personnes.map((p) => p.adresseEmail)).toEqual(['moi@exemple.fr', 'tante@exemple.fr'])
    expect(personnes[1].role).toBe('writer')
  })

  it("invite par e-mail avec le rôle demandé et l'envoi de la notification", async () => {
    const { appels, reseau } = creerReseau(() => new Response('{}', { status: 200 }))
    await inviterPersonne('f1', ' tante@exemple.fr ', 'reader', jeton, reseau)
    expect(appels[0].methode).toBe('POST')
    expect(appels[0].url).toContain('/files/f1/permissions')
    expect(appels[0].url).toContain('sendNotificationEmail=true')
    expect(JSON.parse(appels[0].corps ?? '{}')).toEqual({
      type: 'user',
      role: 'reader',
      emailAddress: 'tante@exemple.fr',
    })
  })

  it("retire l'accès avec DELETE sur la permission", async () => {
    const { appels, reseau } = creerReseau(() => new Response(null, { status: 204 }))
    await retirerAcces('f1', 'p2', jeton, reseau)
    expect(appels[0].methode).toBe('DELETE')
    expect(appels[0].url).toContain('/files/f1/permissions/p2')
  })

  it('lit les droits sur le fichier', async () => {
    const { reseau } = creerReseau(
      () =>
        new Response(JSON.stringify({ ownedByMe: false, capabilities: { canShare: false, canEdit: true } }), {
          status: 200,
        }),
    )
    expect(await lireDroitsSurFichier('f1', jeton, reseau)).toEqual({
      estProprietaire: false,
      peutPartager: false,
      peutModifier: true,
    })
  })

  it("signale un accès retiré (403 / 404) et une connexion expirée (401)", async () => {
    for (const statut of [403, 404]) {
      const { reseau } = creerReseau(() => new Response('{}', { status: statut }))
      await expect(listerPersonnesAvecAcces('f1', jeton, reseau)).rejects.toBeInstanceOf(ErreurAccesFichierDrive)
    }
    const { reseau } = creerReseau(() => new Response('{}', { status: 401 }))
    await expect(listerPersonnesAvecAcces('f1', jeton, reseau)).rejects.toBeInstanceOf(
      ErreurAuthentificationGoogle,
    )
  })
})

describe('fichier de profil partagé', () => {
  it("crée un fichier ordinaire à la racine (sans dossier caché) et renvoie son id", async () => {
    const { appels, reseau } = creerReseau(() => new Response(JSON.stringify({ id: 'nouveau' }), { status: 200 }))
    const identifiant = await creerFichierDrive('Suivi ABC - profil AB.json', '{"a":1}', jeton, reseau)
    expect(identifiant).toBe('nouveau')
    expect(appels[0].corps).toContain('"name":"Suivi ABC - profil AB.json"')
    expect(appels[0].corps).not.toContain('appDataFolder')
  })

  it('lit et met à jour le fichier par son identifiant', async () => {
    let contenu = '{"v":1}'
    const { appels, reseau } = creerReseau((appel) => {
      if (appel.methode === 'PATCH') {
        contenu = appel.corps ?? ''
        return new Response('{}', { status: 200 })
      }
      return new Response(contenu, { status: 200 })
    })
    const stockage = new StockageFichierDrive('f9', jeton, reseau)
    expect(await stockage.lire()).toBe('{"v":1}')
    await stockage.ecrire('{"v":2}')
    expect(await stockage.lire()).toBe('{"v":2}')
    expect(appels[0].url).toContain('/files/f9?alt=media')
    expect(appels[1].url).toContain('/files/f9?uploadType=media')
  })
})

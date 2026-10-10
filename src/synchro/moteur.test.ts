import { describe, expect, it } from 'vitest'
import { elementsAEcrire } from '../fusion'
import type { EntreeABC, Sauvegarde } from '../types'
import { synchroniser } from './moteur'
import { ErreurMotDePasse } from './types'
import type { DepotLocal, StockageDistant } from './types'

function creerEntree(identifiant: string, modifications: Partial<EntreeABC> = {}): EntreeABC {
  return {
    id: identifiant,
    profilId: 'p1',
    dateHeure: '2026-10-09T08:30',
    typeId: 't1',
    antecedents: 'Consigne',
    comportement: 'Cris',
    consequences: 'Pause',
    lieu: 'Salle de classe',
    personnesPresentes: ['Maman'],
    intensite: null,
    dureeMinutes: null,
    fonctionHypothetique: null,
    auteur: 'Parent',
    modifieLe: '2026-10-09T10:00:00.000Z',
    supprime: false,
    ...modifications,
  }
}

function creerSauvegardeVide(): Sauvegarde {
  return {
    version: 1,
    exporteLe: '2026-10-09T12:00:00.000Z',
    profils: [{ id: 'p1', code: 'AB', modifieLe: '2026-10-09T09:00:00.000Z', supprime: false }],
    typesComportement: [
      { id: 't1', nom: 'Crise', couleur: '#ef4444', modifieLe: '2026-10-09T09:00:00.000Z', supprime: false },
    ],
    entrees: [],
  }
}

// Un appareil simulé : ses données sont en mémoire.
function creerAppareil(sauvegardeInitiale: Sauvegarde): DepotLocal & { donnees: Sauvegarde } {
  const appareil = {
    donnees: structuredClone(sauvegardeInitiale),
    async lireSauvegarde() {
      return structuredClone(appareil.donnees)
    },
    async appliquerSauvegarde(sauvegarde: Sauvegarde) {
      const profilsAEcrire = elementsAEcrire(appareil.donnees.profils, sauvegarde.profils)
      const typesAEcrire = elementsAEcrire(appareil.donnees.typesComportement, sauvegarde.typesComportement)
      const entreesAEcrire = elementsAEcrire(appareil.donnees.entrees, sauvegarde.entrees)
      const remplacer = <T extends { id: string }>(existants: T[], nouveaux: T[]) => [
        ...existants.filter((existant) => !nouveaux.some((nouveau) => nouveau.id === existant.id)),
        ...nouveaux,
      ]
      appareil.donnees.profils = remplacer(appareil.donnees.profils, profilsAEcrire)
      appareil.donnees.typesComportement = remplacer(appareil.donnees.typesComportement, typesAEcrire)
      appareil.donnees.entrees = remplacer(appareil.donnees.entrees, entreesAEcrire)
      return profilsAEcrire.length + typesAEcrire.length + entreesAEcrire.length
    },
  }
  return appareil
}

function creerStockageEnMemoire(): StockageDistant & { contenu: string | null; nombreEcritures: number } {
  const stockage = {
    contenu: null as string | null,
    nombreEcritures: 0,
    async lire() {
      return stockage.contenu
    },
    async ecrire(contenu: string) {
      stockage.contenu = contenu
      stockage.nombreEcritures += 1
    },
  }
  return stockage
}

describe('synchroniser', () => {
  it('envoie un fichier chiffré au premier passage', async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    telephone.donnees.entrees.push(creerEntree('e1'))

    const resultat = await synchroniser(stockage, telephone, 'secret')

    expect(resultat.envoye).toBe(true)
    expect(stockage.contenu).not.toBeNull()
    expect(stockage.contenu).not.toContain('Cris')
    expect(stockage.contenu).not.toContain('Salle de classe')
  })

  it("fait apparaître sur l'ordinateur ce qui a été saisi sur le téléphone", async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    telephone.donnees.entrees.push(creerEntree('e1'))
    const ordinateur = creerAppareil({ ...creerSauvegardeVide(), profils: [], typesComportement: [] })

    await synchroniser(stockage, telephone, 'secret')
    const resultat = await synchroniser(stockage, ordinateur, 'secret')

    expect(resultat.elementsRecus).toBe(3)
    expect(ordinateur.donnees.entrees.map((entree) => entree.id)).toEqual(['e1'])
    expect(ordinateur.donnees.profils).toHaveLength(1)
  })

  it('garde les saisies faites séparément sur les deux appareils', async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    const ordinateur = creerAppareil(creerSauvegardeVide())
    await synchroniser(stockage, telephone, 'secret')
    await synchroniser(stockage, ordinateur, 'secret')

    telephone.donnees.entrees.push(creerEntree('e-telephone'))
    ordinateur.donnees.entrees.push(creerEntree('e-ordinateur'))
    await synchroniser(stockage, telephone, 'secret')
    await synchroniser(stockage, ordinateur, 'secret')
    await synchroniser(stockage, telephone, 'secret')

    const identifiantsTelephone = telephone.donnees.entrees.map((entree) => entree.id).sort()
    const identifiantsOrdinateur = ordinateur.donnees.entrees.map((entree) => entree.id).sort()
    expect(identifiantsTelephone).toEqual(['e-ordinateur', 'e-telephone'])
    expect(identifiantsOrdinateur).toEqual(['e-ordinateur', 'e-telephone'])
  })

  it("récupère les données d'un appareil quand l'autre a écrasé le fichier en même temps", async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    const ordinateur = creerAppareil(creerSauvegardeVide())
    await synchroniser(stockage, telephone, 'secret')

    telephone.donnees.entrees.push(creerEntree('e-telephone'))
    ordinateur.donnees.entrees.push(creerEntree('e-ordinateur'))
    // Les deux lisent le même fichier distant, puis le second écrase le premier.
    const contenuAvant = stockage.contenu
    await synchroniser(stockage, telephone, 'secret')
    stockage.contenu = contenuAvant
    await synchroniser(stockage, ordinateur, 'secret')

    // Le fichier distant ne contient plus e-telephone, mais le téléphone l'a toujours.
    await synchroniser(stockage, telephone, 'secret')
    await synchroniser(stockage, ordinateur, 'secret')
    expect(ordinateur.donnees.entrees.map((entree) => entree.id).sort()).toEqual(['e-ordinateur', 'e-telephone'])
  })

  it('propage une suppression et une modification plus récentes', async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    telephone.donnees.entrees.push(creerEntree('e1'), creerEntree('e2'))
    const ordinateur = creerAppareil(creerSauvegardeVide())
    await synchroniser(stockage, telephone, 'secret')
    await synchroniser(stockage, ordinateur, 'secret')

    ordinateur.donnees.entrees = ordinateur.donnees.entrees.map((entree) =>
      entree.id === 'e1'
        ? { ...entree, supprime: true, modifieLe: '2026-10-10T08:00:00.000Z' }
        : { ...entree, comportement: 'Agitation', modifieLe: '2026-10-10T08:05:00.000Z' },
    )
    await synchroniser(stockage, ordinateur, 'secret')
    await synchroniser(stockage, telephone, 'secret')

    const entreeSupprimee = telephone.donnees.entrees.find((entree) => entree.id === 'e1')
    const entreeModifiee = telephone.donnees.entrees.find((entree) => entree.id === 'e2')
    expect(entreeSupprimee?.supprime).toBe(true)
    expect(entreeModifiee?.comportement).toBe('Agitation')
  })

  it("n'envoie rien quand tout est déjà à jour", async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    telephone.donnees.entrees.push(creerEntree('e1'))
    await synchroniser(stockage, telephone, 'secret')
    const ecrituresAvant = stockage.nombreEcritures

    const resultat = await synchroniser(stockage, telephone, 'secret')

    expect(resultat.envoye).toBe(false)
    expect(resultat.elementsRecus).toBe(0)
    expect(stockage.nombreEcritures).toBe(ecrituresAvant)
  })

  it("refuse un mauvais mot de passe sans toucher au fichier ni aux données locales", async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    telephone.donnees.entrees.push(creerEntree('e1'))
    await synchroniser(stockage, telephone, 'bon-mot-de-passe')
    const contenuAvant = stockage.contenu
    const ordinateur = creerAppareil(creerSauvegardeVide())

    await expect(synchroniser(stockage, ordinateur, 'mauvais')).rejects.toBeInstanceOf(ErreurMotDePasse)

    expect(stockage.contenu).toBe(contenuAvant)
    expect(ordinateur.donnees.entrees).toHaveLength(0)
  })

  it('refuse de synchroniser sans mot de passe', async () => {
    const stockage = creerStockageEnMemoire()
    const telephone = creerAppareil(creerSauvegardeVide())
    await expect(synchroniser(stockage, telephone, '')).rejects.toBeInstanceOf(ErreurMotDePasse)
    expect(stockage.contenu).toBeNull()
  })
})

describe('elementsAEcrire', () => {
  it('ne renvoie que les éléments nouveaux ou strictement plus récents', () => {
    const existants = [
      { id: 'a', modifieLe: '2026-01-02T00:00:00Z' },
      { id: 'b', modifieLe: '2026-01-02T00:00:00Z' },
    ]
    const entrants = [
      { id: 'a', modifieLe: '2026-01-02T00:00:00Z' },
      { id: 'b', modifieLe: '2026-01-03T00:00:00Z' },
      { id: 'c', modifieLe: '2026-01-01T00:00:00Z' },
    ]
    expect(elementsAEcrire(existants, entrants).map((element) => element.id)).toEqual(['b', 'c'])
  })
})

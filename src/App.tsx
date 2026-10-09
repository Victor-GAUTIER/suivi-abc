import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { baseSuiviABC } from './db'
import {
  creerProfil,
  ecrireParametre,
  initialiserTypesParDefaut,
  lireParametre,
  parametresConnus,
  supprimerEntree,
} from './depot'
import { Calendrier } from './composants/Calendrier'
import { FormulaireEntree } from './composants/FormulaireEntree'
import { Journal } from './composants/Journal'
import { Parametres } from './composants/Parametres'
import { Statistiques } from './composants/Statistiques'
import type { EntreeABC, TypeComportement } from './types'

type Onglet = 'saisie' | 'journal' | 'calendrier' | 'statistiques' | 'parametres'

const ONGLETS: Array<{ identifiant: Onglet; libelle: string }> = [
  { identifiant: 'saisie', libelle: 'Saisie' },
  { identifiant: 'journal', libelle: 'Journal' },
  { identifiant: 'calendrier', libelle: 'Calendrier' },
  { identifiant: 'statistiques', libelle: 'Statistiques' },
  { identifiant: 'parametres', libelle: 'Paramètres' },
]

export function App() {
  const [ongletActif, setOngletActif] = useState<Onglet>('saisie')
  const [profilActifId, setProfilActifId] = useState('')
  const [auteur, setAuteur] = useState('')
  const [entreeEnEdition, setEntreeEnEdition] = useState<EntreeABC | null>(null)
  const [codeNouveauProfil, setCodeNouveauProfil] = useState('')
  const [initialisationTerminee, setInitialisationTerminee] = useState(false)

  const profils = useLiveQuery(
    () => baseSuiviABC.profils.filter((profil) => !profil.supprime).toArray(),
    [],
  )
  const typesComportement = useLiveQuery(
    () => baseSuiviABC.typesComportement.filter((type) => !type.supprime).toArray(),
    [],
  )
  const typesTousConfondus = useLiveQuery(() => baseSuiviABC.typesComportement.toArray(), [])
  const entreesDuProfil = useLiveQuery(
    () =>
      baseSuiviABC.entrees
        .where('profilId')
        .equals(profilActifId)
        .filter((entree) => !entree.supprime)
        .toArray(),
    [profilActifId],
  )

  useEffect(() => {
    async function initialiser() {
      await initialiserTypesParDefaut()
      const profilMemorise = await lireParametre(parametresConnus.profilActif)
      const auteurMemorise = await lireParametre(parametresConnus.auteur)
      if (profilMemorise !== undefined) {
        setProfilActifId(profilMemorise)
      }
      if (auteurMemorise !== undefined) {
        setAuteur(auteurMemorise)
      }
      setInitialisationTerminee(true)
    }
    void initialiser()
  }, [])

  useEffect(() => {
    if (!initialisationTerminee || profils === undefined) {
      return
    }
    const profilActifExiste = profils.some((profil) => profil.id === profilActifId)
    if (!profilActifExiste && profils.length > 0) {
      setProfilActifId(profils[0].id)
    }
  }, [initialisationTerminee, profils, profilActifId])

  const typesParIdentifiant = new Map<string, TypeComportement>()
  for (const typeComportement of typesTousConfondus ?? []) {
    typesParIdentifiant.set(typeComportement.id, typeComportement)
  }

  async function changerProfilActif(nouveauProfilId: string) {
    setProfilActifId(nouveauProfilId)
    await ecrireParametre(parametresConnus.profilActif, nouveauProfilId)
  }

  async function ajouterProfil(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (codeNouveauProfil.trim() === '') {
      return
    }
    const nouveauProfil = await creerProfil(codeNouveauProfil)
    setCodeNouveauProfil('')
    await changerProfilActif(nouveauProfil.id)
  }

  function demanderModification(entree: EntreeABC) {
    setEntreeEnEdition(entree)
    setOngletActif('saisie')
  }

  async function demanderSuppression(entree: EntreeABC) {
    const confirme = window.confirm('Supprimer ce comportement ?')
    if (confirme) {
      await supprimerEntree(entree.id)
    }
  }

  function terminerSaisie() {
    setEntreeEnEdition(null)
    setOngletActif('journal')
  }

  if (!initialisationTerminee || profils === undefined || typesComportement === undefined) {
    return <p className="chargement">Chargement…</p>
  }

  if (profils.length === 0) {
    return (
      <main className="contenu contenu-accueil">
        <h1>Suivi ABC</h1>
        <p>
          Créez le premier profil. Utilisez un code ou des initiales plutôt qu'un nom complet.
        </p>
        <form className="formulaire" onSubmit={ajouterProfil}>
          <label>
            Code du profil
            <input
              type="text"
              value={codeNouveauProfil}
              onChange={(evenement) => setCodeNouveauProfil(evenement.target.value)}
              required
            />
          </label>
          <button type="submit" className="bouton-principal">
            Créer le profil
          </button>
        </form>
        <p className="texte-aide">
          Vous avez déjà une sauvegarde ? Créez un profil provisoire, puis importez le fichier dans
          Paramètres.
        </p>
      </main>
    )
  }

  const entreesAffichees = entreesDuProfil ?? []

  return (
    <div className="application">
      <header className="barre-haut">
        <h1>Suivi ABC</h1>
        <label className="selecteur-profil">
          <span className="visuellement-cache">Profil actif</span>
          <select
            value={profilActifId}
            onChange={(evenement) => void changerProfilActif(evenement.target.value)}
          >
            {profils.map((profil) => (
              <option key={profil.id} value={profil.id}>
                {profil.code}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="bouton-navigation"
          onClick={() => {
            const code = window.prompt('Code du nouveau profil (initiales ou code) :')
            if (code !== null && code.trim() !== '') {
              void creerProfil(code).then((profil) => changerProfilActif(profil.id))
            }
          }}
          aria-label="Ajouter un profil"
        >
          +
        </button>
      </header>

      <nav className="onglets">
        {ONGLETS.map((onglet) => (
          <button
            key={onglet.identifiant}
            type="button"
            className={onglet.identifiant === ongletActif ? 'onglet onglet-actif' : 'onglet'}
            onClick={() => {
              if (onglet.identifiant !== 'saisie') {
                setEntreeEnEdition(null)
              }
              setOngletActif(onglet.identifiant)
            }}
          >
            {onglet.libelle}
          </button>
        ))}
      </nav>

      <main className="contenu">
        {ongletActif === 'saisie' && (
          <FormulaireEntree
            key={entreeEnEdition?.id ?? 'nouvelle-entree'}
            profilId={profilActifId}
            typesComportement={typesComportement}
            auteurParDefaut={auteur}
            entreeInitiale={entreeEnEdition}
            onTermine={terminerSaisie}
          />
        )}
        {ongletActif === 'journal' && (
          <Journal
            entrees={entreesAffichees}
            typesParIdentifiant={typesParIdentifiant}
            onModifier={demanderModification}
            onSupprimer={demanderSuppression}
          />
        )}
        {ongletActif === 'calendrier' && (
          <Calendrier
            entrees={entreesAffichees}
            typesParIdentifiant={typesParIdentifiant}
            onModifier={demanderModification}
            onSupprimer={demanderSuppression}
          />
        )}
        {ongletActif === 'statistiques' && (
          <Statistiques entrees={entreesAffichees} typesParIdentifiant={typesParIdentifiant} />
        )}
        {ongletActif === 'parametres' && (
          <Parametres
            profils={profils}
            profilActifId={profilActifId}
            typesComportement={typesComportement}
            entreesDuProfilActif={entreesAffichees}
            auteur={auteur}
            onAuteurChange={setAuteur}
          />
        )}
      </main>
    </div>
  )
}

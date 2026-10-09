import { useState } from 'react'
import type { FormEvent } from 'react'
import { creerEntree, ecrireParametre, modifierEntree, parametresConnus } from '../depot'
import type { DonneesSaisieEntree } from '../depot'
import { maintenantLocalISO } from '../dates'
import type { ListesConnues } from '../listes'
import { LIBELLES_FONCTIONS } from '../types'
import type { EntreeABC, FonctionHypothetique, TypeComportement } from '../types'
import { ChoixAvecAjout } from './ChoixAvecAjout'
import { ChoixMultipleAvecAjout } from './ChoixMultipleAvecAjout'

interface ProprietesFormulaireEntree {
  profilId: string
  typesComportement: TypeComportement[]
  auteurParDefaut: string
  listesConnues: ListesConnues
  entreeInitiale: EntreeABC | null
  onAuteurUtilise: (auteur: string) => void
  onTermine: () => void
}

const FONCTIONS_DISPONIBLES = Object.keys(LIBELLES_FONCTIONS) as FonctionHypothetique[]

export function FormulaireEntree({
  profilId,
  typesComportement,
  auteurParDefaut,
  listesConnues,
  entreeInitiale,
  onAuteurUtilise,
  onTermine,
}: ProprietesFormulaireEntree) {
  const [dateHeure, setDateHeure] = useState(entreeInitiale?.dateHeure ?? maintenantLocalISO())
  const [typeId, setTypeId] = useState(entreeInitiale?.typeId ?? typesComportement[0]?.id ?? '')
  const [antecedents, setAntecedents] = useState(entreeInitiale?.antecedents ?? '')
  const [comportement, setComportement] = useState(entreeInitiale?.comportement ?? '')
  const [consequences, setConsequences] = useState(entreeInitiale?.consequences ?? '')
  const [lieu, setLieu] = useState(entreeInitiale?.lieu ?? '')
  const [personnesPresentes, setPersonnesPresentes] = useState<string[]>(
    entreeInitiale?.personnesPresentes ?? [],
  )
  const [intensiteTexte, setIntensiteTexte] = useState(
    entreeInitiale?.intensite === null || entreeInitiale === null
      ? ''
      : String(entreeInitiale.intensite),
  )
  const [dureeTexte, setDureeTexte] = useState(
    entreeInitiale?.dureeMinutes === null || entreeInitiale === null
      ? ''
      : String(entreeInitiale.dureeMinutes),
  )
  const [fonctionTexte, setFonctionTexte] = useState<string>(
    entreeInitiale?.fonctionHypothetique ?? '',
  )
  const [auteur, setAuteur] = useState(entreeInitiale?.auteur ?? auteurParDefaut)
  const [messageErreur, setMessageErreur] = useState('')

  const estModification = entreeInitiale !== null

  async function gererSoumission(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (typeId === '') {
      setMessageErreur("Choisissez un type de comportement (à créer dans l'onglet Paramètres).")
      return
    }
    const donneesSaisie: DonneesSaisieEntree = {
      profilId,
      dateHeure,
      typeId,
      antecedents: antecedents.trim(),
      comportement: comportement.trim(),
      consequences: consequences.trim(),
      lieu: lieu.trim(),
      personnesPresentes,
      intensite: intensiteTexte === '' ? null : Number(intensiteTexte),
      dureeMinutes: dureeTexte === '' ? null : Number(dureeTexte),
      fonctionHypothetique: fonctionTexte === '' ? null : (fonctionTexte as FonctionHypothetique),
      auteur: auteur.trim(),
    }
    if (entreeInitiale === null) {
      await creerEntree(donneesSaisie)
    } else {
      await modifierEntree(entreeInitiale.id, donneesSaisie)
    }
    await ecrireParametre(parametresConnus.auteur, donneesSaisie.auteur)
    onAuteurUtilise(donneesSaisie.auteur)
    onTermine()
  }

  return (
    <form className="formulaire formulaire-compact" onSubmit={gererSoumission}>
      <div className="ligne-champs">
        <label>
          Date et heure
          <input
            type="datetime-local"
            value={dateHeure}
            onChange={(evenement) => setDateHeure(evenement.target.value)}
            required
          />
        </label>

        <label>
          Type de comportement
          <select
            value={typeId}
            onChange={(evenement) => setTypeId(evenement.target.value)}
            required
          >
            {typesComportement.map((typeComportement) => (
              <option key={typeComportement.id} value={typeComportement.id}>
                {typeComportement.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Antécédents (juste avant)
        <textarea
          rows={2}
          value={antecedents}
          onChange={(evenement) => setAntecedents(evenement.target.value)}
          required
        />
      </label>

      <label>
        Comportement (observé)
        <textarea
          rows={2}
          value={comportement}
          onChange={(evenement) => setComportement(evenement.target.value)}
          required
        />
      </label>

      <label>
        Conséquences (juste après)
        <textarea
          rows={2}
          value={consequences}
          onChange={(evenement) => setConsequences(evenement.target.value)}
          required
        />
      </label>

      <div className="ligne-champs">
        <ChoixAvecAjout
          libelle="Lieu"
          valeur={lieu}
          options={listesConnues.lieux}
          libelleVide="Non renseigné"
          libelleAjout="Ajouter un lieu"
          onChange={setLieu}
        />

        <ChoixMultipleAvecAjout
          libelle="Personnes présentes"
          valeurs={personnesPresentes}
          options={listesConnues.personnes}
          libelleVide="Choisir une personne"
          libelleAjout="Ajouter une personne"
          onChange={setPersonnesPresentes}
        />

        <ChoixAvecAjout
          libelle="Saisi par"
          valeur={auteur}
          options={listesConnues.auteurs}
          libelleVide="Non renseigné"
          libelleAjout="Ajouter un auteur"
          onChange={setAuteur}
        />
      </div>

      <details className="options-analyse">
        <summary>Champs d'analyse (facultatifs)</summary>

        <div className="ligne-champs">
          <label>
            Intensité
            <select
              value={intensiteTexte}
              onChange={(evenement) => setIntensiteTexte(evenement.target.value)}
            >
              <option value="">Non renseignée</option>
              <option value="1">1 - très faible</option>
              <option value="2">2 - faible</option>
              <option value="3">3 - moyenne</option>
              <option value="4">4 - forte</option>
              <option value="5">5 - très forte</option>
            </select>
          </label>

          <label>
            Durée (minutes)
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={dureeTexte}
              onChange={(evenement) => setDureeTexte(evenement.target.value)}
            />
          </label>

          <label>
            Fonction hypothétique
            <select
              value={fonctionTexte}
              onChange={(evenement) => setFonctionTexte(evenement.target.value)}
            >
              <option value="">Non renseignée</option>
              {FONCTIONS_DISPONIBLES.map((fonction) => (
                <option key={fonction} value={fonction}>
                  {LIBELLES_FONCTIONS[fonction]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      {messageErreur !== '' && <p className="message-erreur">{messageErreur}</p>}

      <div className="formulaire-actions">
        <button type="submit" className="bouton-principal">
          {estModification ? 'Enregistrer les modifications' : 'Ajouter le comportement'}
        </button>
        {estModification && (
          <button type="button" className="bouton-secondaire" onClick={onTermine}>
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}

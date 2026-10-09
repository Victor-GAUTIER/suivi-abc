import { useState } from 'react'

const VALEUR_NOUVEL_ELEMENT = '__nouvel_element__'

interface ProprietesChoixAvecAjout {
  libelle: string
  valeur: string
  options: string[]
  libelleVide: string
  libelleAjout: string
  onChange: (nouvelleValeur: string) => void
}

// Liste déroulante à choix unique, avec une entrée « + Ajouter … » pour créer un nouvel élément.
export function ChoixAvecAjout({
  libelle,
  valeur,
  options,
  libelleVide,
  libelleAjout,
  onChange,
}: ProprietesChoixAvecAjout) {
  const [enAjout, setEnAjout] = useState(false)
  const [texteNouvelElement, setTexteNouvelElement] = useState('')

  // Une valeur tout juste ajoutée n'est pas encore dans les entrées enregistrées.
  const optionsAffichees =
    valeur !== '' && !options.includes(valeur) ? [...options, valeur] : options

  function annulerAjout() {
    setTexteNouvelElement('')
    setEnAjout(false)
  }

  function confirmerAjout() {
    const texteNettoye = texteNouvelElement.trim()
    if (texteNettoye !== '') {
      const elementExistant = options.find(
        (option) => option.toLocaleLowerCase('fr') === texteNettoye.toLocaleLowerCase('fr'),
      )
      onChange(elementExistant ?? texteNettoye)
    }
    annulerAjout()
  }

  if (enAjout) {
    return (
      <div className="champ-liste">
        <span className="champ-liste-libelle">{libelle}</span>
        <div className="champ-liste-ajout">
          <input
            type="text"
            autoFocus
            value={texteNouvelElement}
            placeholder={libelleAjout}
            aria-label={libelleAjout}
            onChange={(evenement) => setTexteNouvelElement(evenement.target.value)}
            onKeyDown={(evenement) => {
              if (evenement.key === 'Enter') {
                evenement.preventDefault()
                confirmerAjout()
              }
              if (evenement.key === 'Escape') {
                evenement.preventDefault()
                annulerAjout()
              }
            }}
          />
          <button type="button" className="bouton-principal" onClick={confirmerAjout}>
            OK
          </button>
          <button
            type="button"
            className="bouton-secondaire"
            onClick={annulerAjout}
            aria-label="Annuler l'ajout"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <label className="champ-liste">
      {libelle}
      <select
        value={valeur}
        onChange={(evenement) => {
          if (evenement.target.value === VALEUR_NOUVEL_ELEMENT) {
            setEnAjout(true)
          } else {
            onChange(evenement.target.value)
          }
        }}
      >
        <option value="">{libelleVide}</option>
        {optionsAffichees.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={VALEUR_NOUVEL_ELEMENT}>+ {libelleAjout}</option>
      </select>
    </label>
  )
}

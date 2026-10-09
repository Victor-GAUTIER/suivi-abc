import { useState } from 'react'

const VALEUR_NOUVEL_ELEMENT = '__nouvel_element__'

interface ProprietesChoixMultipleAvecAjout {
  libelle: string
  valeurs: string[]
  options: string[]
  libelleVide: string
  libelleAjout: string
  onChange: (nouvellesValeurs: string[]) => void
}

function contientSansCasse(liste: string[], valeurCherchee: string): boolean {
  const valeurNormalisee = valeurCherchee.toLocaleLowerCase('fr')
  return liste.some((element) => element.toLocaleLowerCase('fr') === valeurNormalisee)
}

// Liste déroulante à choix multiple : chaque choix devient une pastille que l'on peut retirer.
// Une entrée « + Ajouter … » permet de créer un nouvel élément.
export function ChoixMultipleAvecAjout({
  libelle,
  valeurs,
  options,
  libelleVide,
  libelleAjout,
  onChange,
}: ProprietesChoixMultipleAvecAjout) {
  const [enAjout, setEnAjout] = useState(false)
  const [texteNouvelElement, setTexteNouvelElement] = useState('')

  const optionsRestantes = options.filter((option) => !contientSansCasse(valeurs, option))

  function annulerAjout() {
    setTexteNouvelElement('')
    setEnAjout(false)
  }

  function confirmerAjout() {
    const texteNettoye = texteNouvelElement.trim()
    if (texteNettoye !== '' && !contientSansCasse(valeurs, texteNettoye)) {
      const elementExistant = options.find(
        (option) => option.toLocaleLowerCase('fr') === texteNettoye.toLocaleLowerCase('fr'),
      )
      onChange([...valeurs, elementExistant ?? texteNettoye])
    }
    annulerAjout()
  }

  return (
    <div className="champ-liste">
      {enAjout ? (
        <>
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
        </>
      ) : (
        <label className="champ-liste">
          {libelle}
          <select
            value=""
            onChange={(evenement) => {
              if (evenement.target.value === VALEUR_NOUVEL_ELEMENT) {
                setEnAjout(true)
              } else if (evenement.target.value !== '') {
                onChange([...valeurs, evenement.target.value])
              }
            }}
          >
            <option value="">{libelleVide}</option>
            {optionsRestantes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={VALEUR_NOUVEL_ELEMENT}>+ {libelleAjout}</option>
          </select>
        </label>
      )}

      {valeurs.length > 0 && (
        <ul className="pastilles" aria-label={`${libelle} sélectionnées`}>
          {valeurs.map((valeur) => (
            <li key={valeur} className="pastille">
              <span>{valeur}</span>
              <button
                type="button"
                aria-label={`Retirer ${valeur}`}
                onClick={() => onChange(valeurs.filter((valeurExistante) => valeurExistante !== valeur))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

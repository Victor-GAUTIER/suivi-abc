import { useState } from 'react'
import { couleurTexteLisible } from '../couleurs'
import {
  NOMS_JOURS_COURTS,
  construireGrilleMensuelle,
  formaterJourFrancais,
  formaterJourISO,
  jourDeDateHeure,
  nomDuMois,
} from '../dates'
import { CarteEntree } from './CarteEntree'
import type { EntreeABC, TypeComportement } from '../types'

interface ProprietesCalendrier {
  entrees: EntreeABC[]
  typesParIdentifiant: Map<string, TypeComportement>
  onModifier: (entree: EntreeABC) => void
  onSupprimer: (entree: EntreeABC) => void
}

export function Calendrier({
  entrees,
  typesParIdentifiant,
  onModifier,
  onSupprimer,
}: ProprietesCalendrier) {
  const aujourdhui = new Date()
  const [annee, setAnnee] = useState(aujourdhui.getFullYear())
  const [indexMois, setIndexMois] = useState(aujourdhui.getMonth())
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null)

  const entreesParJour = new Map<string, EntreeABC[]>()
  for (const entree of entrees) {
    const jour = jourDeDateHeure(entree.dateHeure)
    const entreesDuJour = entreesParJour.get(jour) ?? []
    entreesDuJour.push(entree)
    entreesParJour.set(jour, entreesDuJour)
  }

  function allerAuMoisPrecedent() {
    const datePrecedente = new Date(annee, indexMois - 1, 1)
    setAnnee(datePrecedente.getFullYear())
    setIndexMois(datePrecedente.getMonth())
  }

  function allerAuMoisSuivant() {
    const dateSuivante = new Date(annee, indexMois + 1, 1)
    setAnnee(dateSuivante.getFullYear())
    setIndexMois(dateSuivante.getMonth())
  }

  const jours = construireGrilleMensuelle(annee, indexMois)
  const entreesDuJourSelectionne =
    jourSelectionne === null
      ? []
      : [...(entreesParJour.get(jourSelectionne) ?? [])].sort((entreeA, entreeB) =>
          entreeA.dateHeure.localeCompare(entreeB.dateHeure),
        )

  return (
    <div>
      <div className="calendrier-navigation">
        <button type="button" className="bouton-navigation" onClick={allerAuMoisPrecedent}>
          ←
        </button>
        <h2>
          {nomDuMois(indexMois)} {annee}
        </h2>
        <button type="button" className="bouton-navigation" onClick={allerAuMoisSuivant}>
          →
        </button>
      </div>

      <div className="calendrier-grille calendrier-entetes">
        {NOMS_JOURS_COURTS.map((nomJour) => (
          <div key={nomJour}>{nomJour}</div>
        ))}
      </div>

      <div className="calendrier-grille">
        {jours.map((jour) => {
          const jourISO = formaterJourISO(jour)
          const entreesDuJour = entreesParJour.get(jourISO) ?? []
          const comptesParType = new Map<string, number>()
          for (const entree of entreesDuJour) {
            comptesParType.set(entree.typeId, (comptesParType.get(entree.typeId) ?? 0) + 1)
          }
          const estHorsMois = jour.getMonth() !== indexMois
          const estSelectionne = jourISO === jourSelectionne
          const classes = [
            'calendrier-jour',
            estHorsMois ? 'calendrier-jour-hors-mois' : '',
            estSelectionne ? 'calendrier-jour-selectionne' : '',
          ]
            .filter((classe) => classe !== '')
            .join(' ')
          return (
            <button
              key={jourISO}
              type="button"
              className={classes}
              onClick={() => setJourSelectionne(jourISO)}
            >
              <span className="calendrier-numero">{jour.getDate()}</span>
              {Array.from(comptesParType.entries()).map(([typeId, nombre]) => {
                const typeComportement = typesParIdentifiant.get(typeId)
                const couleurFond = typeComportement?.couleur ?? '#9ca3af'
                return (
                  <span
                    key={typeId}
                    className="pastille-calendrier"
                    style={{ backgroundColor: couleurFond, color: couleurTexteLisible(couleurFond) }}
                  >
                    {typeComportement?.nom ?? '?'} ({nombre})
                  </span>
                )
              })}
            </button>
          )
        })}
      </div>

      {jourSelectionne !== null && (
        <section className="calendrier-detail">
          <h3>Comportements du {formaterJourFrancais(jourSelectionne)}</h3>
          {entreesDuJourSelectionne.length === 0 && (
            <p className="texte-vide">Aucun comportement enregistré ce jour.</p>
          )}
          {entreesDuJourSelectionne.map((entree) => (
            <CarteEntree
              key={entree.id}
              entree={entree}
              typeComportement={typesParIdentifiant.get(entree.typeId)}
              onModifier={onModifier}
              onSupprimer={onSupprimer}
            />
          ))}
        </section>
      )}
    </div>
  )
}

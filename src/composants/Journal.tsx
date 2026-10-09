import { jourDeDateHeure, formaterJourFrancais } from '../dates'
import { CarteEntree } from './CarteEntree'
import type { EntreeABC, TypeComportement } from '../types'

interface ProprietesJournal {
  entrees: EntreeABC[]
  typesParIdentifiant: Map<string, TypeComportement>
  onModifier: (entree: EntreeABC) => void
  onSupprimer: (entree: EntreeABC) => void
}

export function Journal({
  entrees,
  typesParIdentifiant,
  onModifier,
  onSupprimer,
}: ProprietesJournal) {
  if (entrees.length === 0) {
    return <p className="texte-vide">Aucun comportement enregistré pour ce profil.</p>
  }
  const entreesTriees = [...entrees].sort((entreeA, entreeB) =>
    entreeB.dateHeure.localeCompare(entreeA.dateHeure),
  )
  const entreesParJour = new Map<string, EntreeABC[]>()
  for (const entree of entreesTriees) {
    const jour = jourDeDateHeure(entree.dateHeure)
    const entreesDuJour = entreesParJour.get(jour) ?? []
    entreesDuJour.push(entree)
    entreesParJour.set(jour, entreesDuJour)
  }
  return (
    <div className="journal">
      {Array.from(entreesParJour.entries()).map(([jour, entreesDuJour]) => (
        <section key={jour}>
          <h3 className="journal-jour">{formaterJourFrancais(jour)}</h3>
          {entreesDuJour.map((entree) => (
            <CarteEntree
              key={entree.id}
              entree={entree}
              typeComportement={typesParIdentifiant.get(entree.typeId)}
              onModifier={onModifier}
              onSupprimer={onSupprimer}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

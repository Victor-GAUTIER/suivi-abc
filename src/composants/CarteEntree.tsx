import { couleurTexteLisible } from '../couleurs'
import { formaterDateHeureFrancais } from '../dates'
import { LIBELLES_FONCTIONS } from '../types'
import type { EntreeABC, TypeComportement } from '../types'

interface ProprietesCarteEntree {
  entree: EntreeABC
  typeComportement: TypeComportement | undefined
  onModifier: (entree: EntreeABC) => void
  onSupprimer: (entree: EntreeABC) => void
}

export function CarteEntree({
  entree,
  typeComportement,
  onModifier,
  onSupprimer,
}: ProprietesCarteEntree) {
  const couleurFond = typeComportement?.couleur ?? '#9ca3af'
  const nomType = typeComportement?.nom ?? 'Type supprimé'
  return (
    <article className="carte-entree">
      <header className="carte-entree-entete">
        <span
          className="pastille-type"
          style={{ backgroundColor: couleurFond, color: couleurTexteLisible(couleurFond) }}
        >
          {nomType}
        </span>
        <time>{formaterDateHeureFrancais(entree.dateHeure)}</time>
      </header>
      <dl className="carte-entree-details">
        <dt>Antécédents</dt>
        <dd>{entree.antecedents}</dd>
        <dt>Comportement</dt>
        <dd>{entree.comportement}</dd>
        <dt>Conséquences</dt>
        <dd>{entree.consequences}</dd>
        {entree.lieu !== '' && (
          <>
            <dt>Lieu</dt>
            <dd>{entree.lieu}</dd>
          </>
        )}
        {entree.personnesPresentes.length > 0 && (
          <>
            <dt>Personnes présentes</dt>
            <dd>{entree.personnesPresentes.join(', ')}</dd>
          </>
        )}
        {entree.intensite !== null && (
          <>
            <dt>Intensité</dt>
            <dd>{entree.intensite} / 5</dd>
          </>
        )}
        {entree.dureeMinutes !== null && (
          <>
            <dt>Durée</dt>
            <dd>{entree.dureeMinutes} min</dd>
          </>
        )}
        {entree.fonctionHypothetique !== null && (
          <>
            <dt>Fonction hypothétique</dt>
            <dd>{LIBELLES_FONCTIONS[entree.fonctionHypothetique]}</dd>
          </>
        )}
        {entree.auteur !== '' && (
          <>
            <dt>Saisi par</dt>
            <dd>{entree.auteur}</dd>
          </>
        )}
      </dl>
      <footer className="carte-entree-actions">
        <button type="button" className="bouton-secondaire" onClick={() => onModifier(entree)}>
          Modifier
        </button>
        <button type="button" className="bouton-danger" onClick={() => onSupprimer(entree)}>
          Supprimer
        </button>
      </footer>
    </article>
  )
}

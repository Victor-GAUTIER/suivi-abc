import { useSyncExternalStore } from 'react'
import { abonnerEtatPartage, lireEtatPartage } from '../partage/gestionnairePartage'
import { abonnerEtatSynchro, lireEtatSynchro } from '../synchro/gestionnaire'
import { calculerEtatGlobal } from '../etatGlobal'
import { synchroniserToutMaintenant } from '../synchroGlobale'

function formaterDate(dateIso: string | null): string {
  if (dateIso === null) {
    return 'jamais'
  }
  return new Date(dateIso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

// Un seul état et un seul bouton pour la synchronisation personnelle et celle des profils partagés.
export function SynchroGlobale() {
  const etatSynchro = useSyncExternalStore(abonnerEtatSynchro, lireEtatSynchro)
  const etatPartage = useSyncExternalStore(abonnerEtatPartage, lireEtatPartage)
  const etat = calculerEtatGlobal(etatSynchro, etatPartage)

  if (!etat.actif) {
    return (
      <p className="texte-aide">
        Aucune synchronisation n'est activée sur cet appareil. Activez-la ci-dessous pour retrouver
        vos données sur vos autres appareils.
      </p>
    )
  }

  const enCours = etat.statut === 'en_cours'
  return (
    <div className="synchro-globale">
      {etat.statut === 'repos' && <p>Tout est synchronisé. Dernière synchronisation : {formaterDate(etat.derniereSynchroLe)}.</p>}
      {enCours && <p>Synchronisation en cours…</p>}
      {etat.statut === 'reconnexion_necessaire' && (
        <p className="message-information">
          La connexion à Google a expiré. Appuyez sur « Reconnecter » pour tout reprendre
          (dernière synchronisation : {formaterDate(etat.derniereSynchroLe)}).
        </p>
      )}
      {etat.statut === 'erreur' &&
        etat.messagesErreur.map((message) => (
          <p key={message} className="message-erreur">
            {message}
          </p>
        ))}
      <div className="formulaire-actions">
        <button
          type="button"
          className="bouton-principal"
          disabled={enCours}
          onClick={() => void synchroniserToutMaintenant()}
        >
          {etat.statut === 'reconnexion_necessaire' ? 'Reconnecter' : 'Synchroniser maintenant'}
        </button>
      </div>
    </div>
  )
}

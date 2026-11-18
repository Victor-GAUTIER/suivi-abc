import { useEffect, useState, useSyncExternalStore } from 'react'
import { abonnerEtatSynchro, lireEtatSynchro, rejoindreProfil } from '../synchro/gestionnaire'
import { oublierInvitation } from '../partage/invitation'
import type { Invitation } from '../partage/invitation'
import { prechargerBibliothequeGoogle, synchroGoogleEstConfiguree } from '../synchro/googleAuth'

function lireMessageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "L'opération a échoué."
}

interface ProprietesInvitationProfil {
  invitation: Invitation | null
  // Appelée quand l'invitation n'a plus lieu d'être (ignorée ou déjà utilisée).
  onOubliee: () => void
}

// Carte affichée quand l'application a été ouverte depuis un lien d'invitation.
export function InvitationProfil({ invitation, onOubliee }: ProprietesInvitationProfil) {
  const etat = useSyncExternalStore(abonnerEtatSynchro, lireEtatSynchro)
  const [occupe, setOccupe] = useState(false)
  const [messageErreur, setMessageErreur] = useState('')

  const dejaRejoint =
    invitation !== null &&
    etat.configurations.some(
      (configuration) => configuration.identifiantFichier === invitation.identifiantFichier,
    )

  useEffect(() => {
    if (invitation !== null) {
      prechargerBibliothequeGoogle()
    }
  }, [invitation])

  useEffect(() => {
    if (dejaRejoint) {
      oublierInvitation()
      onOubliee()
    }
  }, [dejaRejoint, onOubliee])

  if (invitation === null || dejaRejoint || !synchroGoogleEstConfiguree()) {
    return null
  }

  async function gererRejoindre() {
    if (invitation === null) {
      return
    }
    setMessageErreur('')
    setOccupe(true)
    try {
      await rejoindreProfil(invitation.identifiantFichier)
    } catch (erreur) {
      setMessageErreur(lireMessageErreur(erreur))
    } finally {
      setOccupe(false)
    }
  }

  const nomProfil = invitation.codeProfil !== '' ? `« ${invitation.codeProfil} »` : 'partagé'

  return (
    <section className="carte-statistique accueil-synchro">
      <h2>Invitation à rejoindre le profil {nomProfil}</h2>
      <p className="texte-aide">
        Appuyez sur le bouton, connectez-vous à Google, puis cliquez sur le fichier proposé : le
        profil s'ouvre.
      </p>
      {messageErreur !== '' && <p className="message-erreur">{messageErreur}</p>}
      {messageErreur === '' && etat.statut === 'erreur' && etat.messageErreur !== '' && (
        <p className="message-erreur">{etat.messageErreur}</p>
      )}
      <div className="formulaire-actions">
        <button type="button" className="bouton-principal" disabled={occupe} onClick={() => void gererRejoindre()}>
          {occupe ? 'Ouverture de Google…' : 'Rejoindre ce profil'}
        </button>
        <button
          type="button"
          className="bouton-secondaire"
          disabled={occupe}
          onClick={() => {
            oublierInvitation()
            onOubliee()
          }}
        >
          Ignorer
        </button>
      </div>
    </section>
  )
}

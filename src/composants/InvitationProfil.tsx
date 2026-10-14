import { useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { abonnerEtatPartage, lireEtatPartage, rejoindrePartage } from '../partage/gestionnairePartage'
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
  const etat = useSyncExternalStore(abonnerEtatPartage, lireEtatPartage)
  const [motDePasse, setMotDePasse] = useState('')
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

  async function gererRejoindre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (invitation === null) {
      return
    }
    setMessageErreur('')
    if (motDePasse === '') {
      setMessageErreur('Saisissez le mot de passe du profil.')
      return
    }
    setOccupe(true)
    try {
      await rejoindrePartage(motDePasse, invitation.identifiantFichier)
      setMotDePasse('')
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
      <form className="formulaire formulaire-sans-cadre" onSubmit={gererRejoindre}>
        <label>
          Mot de passe du profil
          <input
            type="password"
            autoComplete="off"
            value={motDePasse}
            onChange={(evenement) => setMotDePasse(evenement.target.value)}
          />
        </label>
        <p className="texte-aide">
          Demandez ce mot de passe à la personne qui vous a envoyé le lien. Vous vous connectez
          ensuite à Google, puis vous sélectionnez le fichier proposé (un seul clic).
        </p>
        {messageErreur !== '' && <p className="message-erreur">{messageErreur}</p>}
        {messageErreur === '' && etat.erreurReprise !== '' && (
          <p className="message-erreur">{etat.erreurReprise}</p>
        )}
        <div className="formulaire-actions">
          <button type="submit" className="bouton-principal" disabled={occupe}>
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
      </form>
    </section>
  )
}

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import {
  abonnerEtatPartage,
  lireEtatPartage,
  rejoindrePartage,
} from '../partage/gestionnairePartage'
import { prechargerBibliothequeGoogle, synchroGoogleEstConfiguree } from '../synchro/googleAuth'

interface ProprietesRejoindreProfilPartage {
  // Sur l'écran d'accueil, il n'y a pas encore de menu de gauche à mentionner.
  surEcranAccueil?: boolean
}

function lireMessageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "L'opération a échoué."
}

export function RejoindreProfilPartage({ surEcranAccueil = false }: ProprietesRejoindreProfilPartage) {
  const etat = useSyncExternalStore(abonnerEtatPartage, lireEtatPartage)
  const [motDePasse, setMotDePasse] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState('')
  const [messageErreur, setMessageErreur] = useState('')

  useEffect(() => {
    prechargerBibliothequeGoogle()
  }, [])

  if (!synchroGoogleEstConfiguree()) {
    return null
  }

  async function gererRejoindre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    setMessage('')
    setMessageErreur('')
    if (motDePasse === '') {
      setMessageErreur('Saisissez le mot de passe du profil partagé.')
      return
    }
    setOccupe(true)
    try {
      const profilId = await rejoindrePartage(motDePasse)
      if (profilId !== null) {
        setMotDePasse('')
        setMessage(
          surEcranAccueil
            ? 'Profil ajouté.'
            : 'Profil ajouté. Sélectionnez-le dans la liste des profils (menu de gauche).',
        )
      }
    } catch (erreur) {
      setMessageErreur(lireMessageErreur(erreur))
    } finally {
      setOccupe(false)
    }
  }

  return (
    <form className="formulaire formulaire-sans-cadre" onSubmit={gererRejoindre}>
      <h4>Ajouter un profil partagé avec moi</h4>
      <label>
        Mot de passe du profil partagé
        <input
          type="password"
          autoComplete="off"
          value={motDePasse}
          onChange={(evenement) => setMotDePasse(evenement.target.value)}
        />
      </label>
      <p className="texte-aide">
        Demandez ce mot de passe à la personne qui a partagé le profil. Après l'avoir saisi,
        connectez-vous à Google puis choisissez le fichier « Suivi ABC - profil … » dans la fenêtre
        Google (onglet « Partagés avec moi »).
      </p>
      <div className="formulaire-actions">
        <button type="submit" className="bouton-secondaire" disabled={occupe}>
          {occupe ? 'Ouverture de Google…' : 'Choisir le fichier dans Google Drive'}
        </button>
      </div>
      {(message !== '' || etat.messageReprise !== '') && (
        <p className="message-information">{message !== '' ? message : etat.messageReprise}</p>
      )}
      {(messageErreur !== '' || etat.erreurReprise !== '') && (
        <p className="message-erreur">{messageErreur !== '' ? messageErreur : etat.erreurReprise}</p>
      )}
    </form>
  )
}

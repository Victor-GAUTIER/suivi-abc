import { useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { prechargerBibliothequeGoogle, synchroGoogleEstConfiguree } from '../synchro/googleAuth'
import {
  abonnerEtatSynchro,
  connecterGoogleDrive,
  deconnecterGoogleDrive,
  lireEtatSynchro,
  synchroniserMaintenant,
} from '../synchro/gestionnaire'

function formaterDateSynchro(dateIso: string | null): string {
  if (dateIso === null) {
    return 'jamais'
  }
  return new Date(dateIso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export function SynchroGoogleDrive() {
  const etat = useSyncExternalStore(abonnerEtatSynchro, lireEtatSynchro)
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('')
  const [messageFormulaire, setMessageFormulaire] = useState('')

  // La bibliothèque Google n'est chargée que lorsque cette section est affichée.
  useEffect(() => {
    prechargerBibliothequeGoogle()
  }, [])

  if (!synchroGoogleEstConfiguree()) {
    return (
      <div>
        <h3>Synchronisation Google Drive</h3>
        <p className="texte-aide">
          Elle n'est pas activée dans cette version de l'application. Utilisez l'export et l'import
          JSON pour transférer vos données.
        </p>
      </div>
    )
  }

  async function gererConnexion(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    setMessageFormulaire('')
    if (motDePasse.length < 8) {
      setMessageFormulaire('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (motDePasse !== confirmationMotDePasse) {
      setMessageFormulaire('Les deux mots de passe ne sont pas identiques.')
      return
    }
    const reussite = await connecterGoogleDrive(motDePasse)
    if (reussite) {
      setMotDePasse('')
      setConfirmationMotDePasse('')
    }
  }

  if (etat.statut === 'inactive' || (etat.statut === 'en_cours' && etat.derniereSynchroLe === null)) {
    const connexionEnCours = etat.statut === 'en_cours'
    return (
      <div>
        <h3>Synchronisation Google Drive</h3>
        <p className="texte-aide">
          Vos données sont chiffrées sur cet appareil avant d'être envoyées dans un dossier caché de
          votre Google Drive, visible uniquement par cette application. Saisissez le même mot de
          passe sur chaque appareil.
        </p>
        <form className="formulaire formulaire-sans-cadre" onSubmit={gererConnexion}>
          <label>
            Mot de passe de chiffrement
            <input
              type="password"
              autoComplete="new-password"
              value={motDePasse}
              onChange={(evenement) => setMotDePasse(evenement.target.value)}
              required
            />
          </label>
          <label>
            Confirmer le mot de passe
            <input
              type="password"
              autoComplete="new-password"
              value={confirmationMotDePasse}
              onChange={(evenement) => setConfirmationMotDePasse(evenement.target.value)}
              required
            />
          </label>
          <p className="texte-aide">
            Attention : un mot de passe perdu rend le fichier de synchronisation illisible. Il n'existe
            pas de récupération.
          </p>
          {messageFormulaire !== '' && <p className="message-erreur">{messageFormulaire}</p>}
          {etat.messageErreur !== '' && <p className="message-erreur">{etat.messageErreur}</p>}
          <div className="formulaire-actions">
            <button type="submit" className="bouton-principal" disabled={connexionEnCours}>
              {connexionEnCours ? 'Connexion en cours…' : 'Connecter Google Drive'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  const enCours = etat.statut === 'en_cours'
  return (
    <div>
      <h3>Synchronisation Google Drive</h3>
      {etat.statut === 'repos' && (
        <p>Connecté. Dernière synchronisation : {formaterDateSynchro(etat.derniereSynchroLe)}.</p>
      )}
      {enCours && <p>Synchronisation en cours…</p>}
      {etat.statut === 'reconnexion_necessaire' && (
        <p className="message-information">
          La connexion à Google a expiré. Appuyez sur « Reconnecter » pour reprendre la
          synchronisation (dernière : {formaterDateSynchro(etat.derniereSynchroLe)}).
          {etat.messageErreur !== '' && <> Détail : {etat.messageErreur}</>}
        </p>
      )}
      {etat.statut === 'erreur' && <p className="message-erreur">{etat.messageErreur}</p>}
      <div className="formulaire-actions">
        {etat.statut === 'reconnexion_necessaire' ? (
          <button
            type="button"
            className="bouton-principal"
            onClick={() => void synchroniserMaintenant(true)}
          >
            Reconnecter
          </button>
        ) : (
          <button
            type="button"
            className="bouton-principal"
            disabled={enCours}
            onClick={() => void synchroniserMaintenant(true)}
          >
            Synchroniser maintenant
          </button>
        )}
        <button
          type="button"
          className="bouton-secondaire"
          disabled={enCours}
          onClick={() => {
            const confirme = window.confirm(
              'Se déconnecter de Google Drive ? Les données restent sur cet appareil.',
            )
            if (confirme) {
              void deconnecterGoogleDrive()
            }
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}

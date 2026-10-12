import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import {
  abonnerEtatPartage,
  activerPartage,
  arreterPartage,
  inviterAccesPartage,
  lireDroitsPartage,
  lireEtatPartage,
  listerAccesPartage,
  rejoindrePartage,
  retirerAccesPartage,
  synchroniserPartageMaintenant,
} from '../partage/gestionnairePartage'
import { LIBELLES_ROLES } from '../partage/permissions'
import type { DroitsSurFichier, PersonneAvecAcces, RolePartage } from '../partage/permissions'
import { prechargerBibliothequeGoogle, synchroGoogleEstConfiguree } from '../synchro/googleAuth'
import type { Profil } from '../types'

interface ProprietesPartageProfils {
  profils: Profil[]
  profilActifId: string
}

const LONGUEUR_MINIMALE_MOT_DE_PASSE = 8

function formaterDate(dateIso: string | null): string {
  if (dateIso === null) {
    return 'jamais'
  }
  return new Date(dateIso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function lireMessageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "L'opération a échoué."
}

export function PartageProfils({ profils, profilActifId }: ProprietesPartageProfils) {
  const etat = useSyncExternalStore(abonnerEtatPartage, lireEtatPartage)
  const profilActif = profils.find((profil) => profil.id === profilActifId)
  const configurationActive = etat.configurations.find(
    (configuration) => configuration.profilId === profilActifId,
  )
  const etatProfilActif = etat.parProfil[profilActifId]

  const [motDePasse, setMotDePasse] = useState('')
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('')
  const [motDePasseRejoindre, setMotDePasseRejoindre] = useState('')
  const [adresseInvitee, setAdresseInvitee] = useState('')
  const [roleInvite, setRoleInvite] = useState<RolePartage>('writer')
  const [droits, setDroits] = useState<DroitsSurFichier | null>(null)
  const [personnes, setPersonnes] = useState<PersonneAvecAcces[]>([])
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState('')
  const [messageErreur, setMessageErreur] = useState('')

  useEffect(() => {
    prechargerBibliothequeGoogle()
  }, [])

  const chargerAcces = useCallback(async () => {
    if (configurationActive === undefined) {
      setDroits(null)
      setPersonnes([])
      return
    }
    try {
      const droitsLus = await lireDroitsPartage(profilActifId)
      setDroits(droitsLus)
      setPersonnes(droitsLus.peutPartager ? await listerAccesPartage(profilActifId) : [])
    } catch (erreur) {
      setDroits(null)
      setPersonnes([])
      setMessageErreur(lireMessageErreur(erreur))
    }
    // Seul l'identifiant du fichier compte ici, pas l'état de synchro qui change souvent.
  }, [profilActifId, configurationActive?.identifiantFichier])

  useEffect(() => {
    setMessage('')
    setMessageErreur('')
  }, [profilActifId])

  useEffect(() => {
    // Le chargement n'est tenté qu'au clic sur « Afficher les accès » pour ne pas
    // ouvrir de fenêtre Google sans action de l'utilisateur.
    setDroits(null)
    setPersonnes([])
  }, [profilActifId, configurationActive?.identifiantFichier])

  if (!synchroGoogleEstConfiguree()) {
    return (
      <div>
        <h3>Partage de profils</h3>
        <p className="texte-aide">
          Le partage n'est pas activé dans cette version de l'application (connexion Google non
          configurée).
        </p>
      </div>
    )
  }

  async function executer(operation: () => Promise<void>) {
    setOccupe(true)
    setMessage('')
    setMessageErreur('')
    try {
      await operation()
    } catch (erreur) {
      setMessageErreur(lireMessageErreur(erreur))
    } finally {
      setOccupe(false)
    }
  }

  function verifierMotDePasseChoisi(): boolean {
    if (motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
      setMessageErreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`)
      return false
    }
    if (motDePasse !== confirmationMotDePasse) {
      setMessageErreur('Les deux mots de passe ne sont pas identiques.')
      return false
    }
    return true
  }

  async function gererActivation(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (profilActif === undefined) {
      return
    }
    setMessageErreur('')
    if (!verifierMotDePasseChoisi()) {
      return
    }
    await executer(async () => {
      await activerPartage(profilActif.id, profilActif.code, motDePasse)
      setMotDePasse('')
      setConfirmationMotDePasse('')
      setMessage('Partage activé. Vous pouvez maintenant inviter des personnes.')
    })
  }

  async function gererInvitation(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (adresseInvitee.trim() === '') {
      return
    }
    await executer(async () => {
      await inviterAccesPartage(profilActifId, adresseInvitee, roleInvite)
      setAdresseInvitee('')
      setMessage(
        "Invitation envoyée par Google. Communiquez aussi le mot de passe du profil à cette personne (par un autre moyen que l'e-mail).",
      )
      await chargerAcces()
    })
  }

  async function gererRejoindre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (motDePasseRejoindre === '') {
      setMessageErreur('Saisissez le mot de passe du profil partagé.')
      return
    }
    await executer(async () => {
      const profilId = await rejoindrePartage(motDePasseRejoindre)
      if (profilId !== null) {
        setMotDePasseRejoindre('')
        setMessage('Profil ajouté. Sélectionnez-le dans la liste des profils (menu de gauche).')
      }
    })
  }

  return (
    <div>
      <h3>Partage de profils (Google Drive)</h3>
      <p className="texte-aide">
        Un profil partagé est un fichier chiffré dans votre Google Drive, que vous partagez avec
        d'autres comptes Google. Les personnes invitées peuvent ajouter ou modifier des saisies,
        qui se synchronisent entre tous les appareils.
      </p>

      {profilActif !== undefined && configurationActive === undefined && (
        <form className="formulaire formulaire-sans-cadre" onSubmit={gererActivation}>
          <h4>Partager le profil « {profilActif.code} »</h4>
          <label>
            Mot de passe de ce profil
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
            Toutes les personnes qui partagent ce profil utilisent ce même mot de passe. Il est
            impossible de le récupérer s'il est perdu. Le code du profil apparaît dans le nom du
            fichier Drive et dans l'e-mail d'invitation : choisissez un code qui ne permet pas
            d'identifier la personne.
          </p>
          <div className="formulaire-actions">
            <button type="submit" className="bouton-principal" disabled={occupe}>
              {occupe ? 'Activation…' : 'Activer le partage de ce profil'}
            </button>
          </div>
        </form>
      )}

      {profilActif !== undefined && configurationActive !== undefined && (
        <div>
          <h4>Profil « {profilActif.code} » partagé</h4>
          {(etatProfilActif === undefined || etatProfilActif.statut === 'repos') && (
            <p>Dernière synchronisation : {formaterDate(etatProfilActif?.derniereSynchroLe ?? null)}.</p>
          )}
          {etatProfilActif?.statut === 'en_cours' && <p>Synchronisation en cours…</p>}
          {etatProfilActif?.statut === 'reconnexion_necessaire' && (
            <p className="message-information">
              La connexion à Google a expiré. Appuyez sur « Reconnecter » pour reprendre.
            </p>
          )}
          {etatProfilActif?.statut === 'erreur' && (
            <p className="message-erreur">{etatProfilActif.messageErreur}</p>
          )}

          <div className="formulaire-actions">
            <button
              type="button"
              className="bouton-principal"
              disabled={occupe || etatProfilActif?.statut === 'en_cours'}
              onClick={() => void executer(synchroniserPartageMaintenant)}
            >
              {etatProfilActif?.statut === 'reconnexion_necessaire' ? 'Reconnecter' : 'Synchroniser maintenant'}
            </button>
            <button
              type="button"
              className="bouton-secondaire"
              disabled={occupe}
              onClick={() => void executer(chargerAcces)}
            >
              Afficher les accès
            </button>
            <button
              type="button"
              className="bouton-secondaire"
              disabled={occupe}
              onClick={() => {
                const confirme = window.confirm(
                  'Arrêter la synchronisation de ce profil sur cet appareil ? Les données restent sur cet appareil et le fichier reste dans Drive.',
                )
                if (confirme) {
                  void executer(() => arreterPartage(profilActifId))
                }
              }}
            >
              Arrêter sur cet appareil
            </button>
          </div>

          {droits !== null && (
            <div>
              {droits.peutPartager ? (
                <>
                  <h4>Personnes ayant accès</h4>
                  <ul className="liste-acces">
                    {personnes.map((personne) => (
                      <li key={personne.identifiantPermission}>
                        <span>
                          {personne.adresseEmail}
                          {personne.nomAffiche !== '' ? ` (${personne.nomAffiche})` : ''} —{' '}
                          {LIBELLES_ROLES[personne.role] ?? personne.role}
                        </span>
                        {personne.role !== 'owner' && (
                          <button
                            type="button"
                            className="bouton-secondaire"
                            disabled={occupe}
                            onClick={() =>
                              void executer(async () => {
                                await retirerAccesPartage(profilActifId, personne.identifiantPermission)
                                await chargerAcces()
                              })
                            }
                          >
                            Retirer
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <form className="formulaire formulaire-sans-cadre" onSubmit={gererInvitation}>
                    <div className="ligne-champs">
                      <label>
                        Adresse du compte Google à inviter
                        <input
                          type="email"
                          value={adresseInvitee}
                          onChange={(evenement) => setAdresseInvitee(evenement.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Droits
                        <select
                          value={roleInvite}
                          onChange={(evenement) => setRoleInvite(evenement.target.value as RolePartage)}
                        >
                          <option value="writer">Peut modifier</option>
                          <option value="reader">Lecture seule</option>
                        </select>
                      </label>
                    </div>
                    <div className="formulaire-actions">
                      <button type="submit" className="bouton-principal" disabled={occupe}>
                        Inviter
                      </button>
                    </div>
                  </form>
                  <p className="texte-aide">
                    Retirer une personne coupe son accès au fichier, mais elle garde ce qu'elle a déjà
                    synchronisé et connaît le mot de passe : pour une révocation complète, créez un
                    nouveau partage avec un nouveau mot de passe.
                  </p>
                </>
              ) : (
                <p className="texte-aide">
                  Vous avez accès à ce profil en {droits.peutModifier ? 'modification' : 'lecture seule'}.
                  Seul le propriétaire peut gérer les accès.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <form className="formulaire formulaire-sans-cadre" onSubmit={gererRejoindre}>
        <h4>Ajouter un profil partagé avec moi</h4>
        <label>
          Mot de passe du profil partagé
          <input
            type="password"
            autoComplete="off"
            value={motDePasseRejoindre}
            onChange={(evenement) => setMotDePasseRejoindre(evenement.target.value)}
          />
        </label>
        <p className="texte-aide">
          Après avoir saisi le mot de passe, choisissez le fichier « Suivi ABC - profil … » dans la
          fenêtre Google (onglet « Partagés avec moi »).
        </p>
        <div className="formulaire-actions">
          <button type="submit" className="bouton-secondaire" disabled={occupe}>
            Choisir le fichier dans Google Drive
          </button>
        </div>
      </form>

      {message !== '' && <p className="message-information">{message}</p>}
      {messageErreur !== '' && <p className="message-erreur">{messageErreur}</p>}
    </div>
  )
}

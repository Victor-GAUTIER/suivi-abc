import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import {
  inviterAccesPartage,
  lireDroitsPartage,
  listerAccesPartage,
  retirerAccesPartage,
} from '../partage/gestionnairePartage'
import { construireLienInvitation } from '../partage/invitation'
import { LIBELLES_ROLES } from '../partage/permissions'
import type { DroitsSurFichier, PersonneAvecAcces, RolePartage } from '../partage/permissions'
import { abonnerEtatSynchro, lireEtatSynchro } from '../synchro/gestionnaire'
import { synchroGoogleEstConfiguree } from '../synchro/googleAuth'
import { adresseDeRetour } from '../synchro/redirectionGoogle'
import type { Profil } from '../types'

interface ProprietesPartageProfils {
  profils: Profil[]
  profilActifId: string
}

function lireMessageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : "L'opération a échoué."
}

// Partager le profil actif : on saisit une adresse Google, Google envoie un e-mail contenant
// le lien. La personne clique sur le lien et arrive sur le profil.
export function PartageProfils({ profils, profilActifId }: ProprietesPartageProfils) {
  const etat = useSyncExternalStore(abonnerEtatSynchro, lireEtatSynchro)
  const profilActif = profils.find((profil) => profil.id === profilActifId)
  const configurationActive = etat.configurations.find(
    (configuration) => configuration.profilId === profilActifId,
  )

  const [adresseInvitee, setAdresseInvitee] = useState('')
  const [roleInvite, setRoleInvite] = useState<RolePartage>('writer')
  const [droits, setDroits] = useState<DroitsSurFichier | null>(null)
  const [personnes, setPersonnes] = useState<PersonneAvecAcces[]>([])
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState('')
  const [messageErreur, setMessageErreur] = useState('')

  const chargerAcces = useCallback(async () => {
    if (configurationActive === undefined) {
      setDroits(null)
      setPersonnes([])
      return
    }
    const droitsLus = await lireDroitsPartage(profilActifId)
    setDroits(droitsLus)
    setPersonnes(droitsLus.peutPartager ? await listerAccesPartage(profilActifId) : [])
    // Seul l'identifiant du fichier compte ici, pas l'état de synchro qui change souvent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilActifId, configurationActive?.identifiantFichier])

  useEffect(() => {
    // Le chargement n'est tenté qu'au clic sur « Afficher les accès » pour ne pas
    // ouvrir de fenêtre Google sans action de l'utilisateur.
    setMessage('')
    setMessageErreur('')
    setDroits(null)
    setPersonnes([])
  }, [profilActifId, configurationActive?.identifiantFichier])

  if (!synchroGoogleEstConfiguree()) {
    return null
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

  const lienInvitation =
    configurationActive === undefined || profilActif === undefined
      ? ''
      : construireLienInvitation(
          adresseDeRetour(location.origin, location.pathname),
          configurationActive.identifiantFichier,
          profilActif.code,
        )

  // Texte ajouté par Google à l'e-mail d'invitation.
  const messageInvitation =
    profilActif === undefined || lienInvitation === ''
      ? null
      : `Vous êtes invité(e) à rejoindre le profil « ${profilActif.code} » dans Suivi ABC.\n\n` +
        `Ouvrez ce lien pour le rejoindre :\n${lienInvitation}`

  async function gererInvitation(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (adresseInvitee.trim() === '') {
      return
    }
    await executer(async () => {
      await inviterAccesPartage(profilActifId, adresseInvitee, roleInvite, messageInvitation)
      setAdresseInvitee('')
      setMessage('Invitation envoyée par Google. La personne n’a qu’à cliquer sur le lien reçu.')
      await chargerAcces()
    })
  }

  async function copierLienInvitation() {
    try {
      await navigator.clipboard.writeText(lienInvitation)
      setMessage('Lien copié. Il ne fonctionne que pour les comptes Google déjà invités.')
    } catch {
      setMessageErreur('Copie impossible : sélectionnez le lien et copiez-le à la main.')
    }
  }

  return (
    <div>
      <h4>Partager le profil{profilActif !== undefined ? ` « ${profilActif.code} »` : ''}</h4>
      <p className="texte-aide">
        Saisissez l'adresse Google de la personne : elle reçoit un e-mail avec un lien. Un clic sur
        le lien, une connexion à Google, et le profil s'ouvre chez elle. Les saisies se
        synchronisent ensuite entre tous vos appareils.
      </p>

      {configurationActive === undefined ? (
        <p className="texte-aide">
          Ce profil n'est pas encore synchronisé : appuyez sur « Synchroniser » pour pouvoir le
          partager.
        </p>
      ) : (
        <>
          <div className="formulaire-actions">
            <button
              type="button"
              className="bouton-secondaire"
              disabled={occupe}
              onClick={() => void executer(chargerAcces)}
            >
              Afficher les personnes ayant accès
            </button>
          </div>

          {droits !== null && !droits.peutPartager && (
            <p className="texte-aide">
              Vous avez accès à ce profil en {droits.peutModifier ? 'modification' : 'lecture seule'}.
              Seul le propriétaire peut gérer les accès.
            </p>
          )}

          {(droits === null || droits.peutPartager) && (
            <form className="formulaire formulaire-sans-cadre" onSubmit={gererInvitation}>
              <div className="ligne-champs">
                <label>
                  Adresse Google à inviter
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
                <button
                  type="button"
                  className="bouton-secondaire"
                  onClick={() => void copierLienInvitation()}
                >
                  Copier le lien
                </button>
              </div>
            </form>
          )}

          {droits?.peutPartager === true && (
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
              <p className="texte-aide">
                Retirer une personne coupe son accès au fichier, mais elle garde ce qu'elle a déjà
                synchronisé sur ses appareils.
              </p>
            </>
          )}
        </>
      )}

      {message !== '' && <p className="message-information">{message}</p>}
      {messageErreur !== '' && <p className="message-erreur">{messageErreur}</p>}
    </div>
  )
}

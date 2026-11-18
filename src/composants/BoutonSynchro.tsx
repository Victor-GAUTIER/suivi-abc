import { useEffect, useSyncExternalStore } from 'react'
import { abonnerEtatSynchro, lireEtatSynchro, synchroniserMaintenant } from '../synchro/gestionnaire'
import { prechargerBibliothequeGoogle, synchroGoogleEstConfiguree } from '../synchro/googleAuth'
import { Icone } from './Icones'

function formaterDate(dateIso: string | null): string {
  if (dateIso === null) {
    return 'jamais'
  }
  return new Date(dateIso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

interface ProprietesBoutonSynchro {
  // Version large (écran d'accueil, paramètres) : texte explicatif et bouton plus grand.
  grand?: boolean
}

// L'unique bouton de synchronisation, affiché sur toutes les pages.
export function BoutonSynchro({ grand = false }: ProprietesBoutonSynchro) {
  const etat = useSyncExternalStore(abonnerEtatSynchro, lireEtatSynchro)

  useEffect(() => {
    prechargerBibliothequeGoogle()
  }, [])

  if (!synchroGoogleEstConfiguree()) {
    return null
  }

  const enCours = etat.statut === 'en_cours'
  let libelle = 'Synchroniser'
  if (enCours) {
    libelle = 'Synchronisation…'
  } else if (etat.statut === 'reconnexion_necessaire') {
    libelle = 'Reconnecter'
  } else if (etat.statut === 'erreur') {
    libelle = 'Réessayer'
  } else if (!etat.connecte) {
    libelle = grand ? 'Se connecter à Google et synchroniser' : 'Synchroniser'
  }

  let statut = ''
  if (enCours) {
    statut = 'Synchronisation en cours…'
  } else if (etat.statut === 'reconnexion_necessaire') {
    statut = 'La connexion à Google a expiré : appuyez sur « Reconnecter ».'
  } else if (etat.statut === 'repos' && etat.connecte) {
    statut = `Synchronisé (dernière fois : ${formaterDate(etat.derniereSynchroLe)}).`
  } else if (!etat.connecte && etat.statut === 'repos') {
    statut = 'Non synchronisé : vos données restent sur cet appareil.'
  }

  return (
    <div className={grand ? 'synchro-rapide synchro-rapide-grande' : 'synchro-rapide'}>
      <button
        type="button"
        className={grand ? 'bouton-principal bouton-synchro' : 'bouton-synchro bouton-synchro-compact'}
        disabled={enCours}
        aria-label={libelle}
        title={statut !== '' ? statut : libelle}
        onClick={() => void synchroniserMaintenant()}
      >
        <span className={enCours ? 'icone-tournante' : undefined}>
          <Icone nom="synchro" />
        </span>
        <span className="synchro-libelle">{libelle}</span>
      </button>
      {etat.statut === 'erreur' && etat.messageErreur !== '' && (
        <p className="message-erreur synchro-message" role="alert">
          {etat.messageErreur}
        </p>
      )}
      {etat.statut === 'reconnexion_necessaire' && etat.messageErreur !== '' && (
        <p className="message-erreur synchro-message">{etat.messageErreur}</p>
      )}
      {grand && statut !== '' && (
        <p className="texte-aide" role="status">
          {statut}
        </p>
      )}
    </div>
  )
}

import type { EtatPartage } from './partage/gestionnairePartage'
import type { EtatSynchro } from './synchro/gestionnaire'

export type StatutGlobal = 'repos' | 'en_cours' | 'reconnexion_necessaire' | 'erreur'

export interface EtatGlobal {
  // Faux quand ni la synchronisation personnelle ni aucun profil partagé n'est activé.
  actif: boolean
  statut: StatutGlobal
  // La plus ancienne des dernières synchronisations (null : au moins une n'a jamais eu lieu).
  derniereSynchroLe: string | null
  messagesErreur: string[]
}

const PRIORITE: Record<StatutGlobal, number> = {
  repos: 0,
  erreur: 1,
  reconnexion_necessaire: 2,
  en_cours: 3,
}

// Résume la synchronisation personnelle et celle des profils partagés en un seul état.
export function calculerEtatGlobal(etatSynchro: EtatSynchro, etatPartage: EtatPartage): EtatGlobal {
  const elements: Array<{ statut: StatutGlobal; derniereLe: string | null; erreur: string }> = []

  if (etatSynchro.statut !== 'inactive') {
    elements.push({
      statut: etatSynchro.statut,
      derniereLe: etatSynchro.derniereSynchroLe,
      erreur: etatSynchro.messageErreur,
    })
  }

  for (const configuration of etatPartage.configurations) {
    const etatProfil = etatPartage.parProfil[configuration.profilId]
    elements.push({
      statut: etatProfil?.statut ?? 'repos',
      derniereLe: etatProfil?.derniereSynchroLe ?? null,
      erreur: etatProfil?.messageErreur ?? '',
    })
  }

  if (elements.length === 0) {
    return { actif: false, statut: 'repos', derniereSynchroLe: null, messagesErreur: [] }
  }

  let statut: StatutGlobal = 'repos'
  for (const element of elements) {
    if (PRIORITE[element.statut] > PRIORITE[statut]) {
      statut = element.statut
    }
  }

  const dates = elements.map((element) => element.derniereLe)
  const derniereSynchroLe = dates.some((date) => date === null)
    ? null
    : (dates as string[]).reduce((plusAncienne, date) => (date < plusAncienne ? date : plusAncienne))

  const messagesErreur = elements
    .filter((element) => element.statut === 'erreur' && element.erreur !== '')
    .map((element) => element.erreur)

  return {
    actif: true,
    statut,
    derniereSynchroLe,
    messagesErreur: [...new Set(messagesErreur)],
  }
}

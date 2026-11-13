import { lireEtatPartage, synchroniserPartageMaintenant } from './partage/gestionnairePartage'
import { lireEtatSynchro, synchroniserMaintenant } from './synchro/gestionnaire'

// Un seul bouton pour tout : d'abord les données personnelles, puis les profils partagés.
export async function synchroniserToutMaintenant(): Promise<void> {
  if (lireEtatSynchro().statut !== 'inactive') {
    await synchroniserMaintenant(true)
  }
  if (lireEtatPartage().configurations.length > 0) {
    await synchroniserPartageMaintenant()
  }
}

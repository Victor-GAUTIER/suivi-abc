const NOMS_MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

export const NOMS_JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function deuxChiffres(valeur: number): string {
  return String(valeur).padStart(2, '0')
}

export function formaterJourISO(date: Date): string {
  const annee = date.getFullYear()
  const mois = deuxChiffres(date.getMonth() + 1)
  const jour = deuxChiffres(date.getDate())
  return `${annee}-${mois}-${jour}`
}

export function maintenantLocalISO(): string {
  const maintenant = new Date()
  const jour = formaterJourISO(maintenant)
  const heures = deuxChiffres(maintenant.getHours())
  const minutes = deuxChiffres(maintenant.getMinutes())
  return `${jour}T${heures}:${minutes}`
}

export function maintenantHorodatage(): string {
  return new Date().toISOString()
}

export function jourDeDateHeure(dateHeure: string): string {
  return dateHeure.slice(0, 10)
}

export function heureDeDateHeure(dateHeure: string): number {
  return Number.parseInt(dateHeure.slice(11, 13), 10)
}

export function formaterDateHeureFrancais(dateHeure: string): string {
  const [partieJour, partieHeure] = dateHeure.split('T')
  const [annee, mois, jour] = partieJour.split('-')
  return `${jour}/${mois}/${annee} ${partieHeure ?? ''}`.trim()
}

export function formaterJourFrancais(jourISO: string): string {
  const [annee, mois, jour] = jourISO.split('-')
  return `${jour}/${mois}/${annee}`
}

export function nomDuMois(indexMois: number): string {
  return NOMS_MOIS[indexMois]
}

export function creerDateLocaleDepuisJour(jourISO: string): Date {
  const [annee, mois, jour] = jourISO.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}

export function construireGrilleMensuelle(annee: number, indexMois: number): Date[] {
  const premierDuMois = new Date(annee, indexMois, 1)
  const decalageDepuisLundi = (premierDuMois.getDay() + 6) % 7
  const premierJourAffiche = new Date(annee, indexMois, 1 - decalageDepuisLundi)
  const dernierDuMois = new Date(annee, indexMois + 1, 0)
  const decalageJusquADimanche = (7 - ((dernierDuMois.getDay() + 6) % 7) - 1) % 7
  const dernierJourAffiche = new Date(
    annee,
    indexMois,
    dernierDuMois.getDate() + decalageJusquADimanche,
  )
  const jours: Date[] = []
  const curseur = new Date(premierJourAffiche)
  while (curseur <= dernierJourAffiche) {
    jours.push(new Date(curseur))
    curseur.setDate(curseur.getDate() + 1)
  }
  return jours
}

import { LIBELLES_FONCTIONS } from './types'
import type { EntreeABC, Profil, TypeComportement } from './types'

const SEPARATEUR_CSV = ';'

function echapperCelluleCSV(valeur: string): string {
  const doitEtreProtegee =
    valeur.includes(SEPARATEUR_CSV) ||
    valeur.includes('"') ||
    valeur.includes('\n') ||
    valeur.includes('\r')
  if (!doitEtreProtegee) {
    return valeur
  }
  return `"${valeur.replaceAll('"', '""')}"`
}

export function construireCSV(
  entrees: EntreeABC[],
  profils: Profil[],
  typesComportement: TypeComportement[],
): string {
  const codeProfilParIdentifiant = new Map(profils.map((profil) => [profil.id, profil.code]))
  const nomTypeParIdentifiant = new Map(typesComportement.map((type) => [type.id, type.nom]))
  const enTetes = [
    'Profil',
    'Date et heure',
    'Type',
    'Antécédents',
    'Comportement',
    'Conséquences',
    'Lieu',
    'Personnes présentes',
    'Intensité (1-5)',
    'Durée (minutes)',
    'Fonction hypothétique',
    'Auteur',
  ]
  const lignes = [enTetes.map(echapperCelluleCSV).join(SEPARATEUR_CSV)]
  const entreesTriees = [...entrees].sort((entreeA, entreeB) =>
    entreeA.dateHeure.localeCompare(entreeB.dateHeure),
  )
  for (const entree of entreesTriees) {
    const cellules = [
      codeProfilParIdentifiant.get(entree.profilId) ?? '',
      entree.dateHeure.replace('T', ' '),
      nomTypeParIdentifiant.get(entree.typeId) ?? '',
      entree.antecedents,
      entree.comportement,
      entree.consequences,
      entree.lieu,
      entree.personnesPresentes.join(', '),
      entree.intensite === null ? '' : String(entree.intensite),
      entree.dureeMinutes === null ? '' : String(entree.dureeMinutes),
      entree.fonctionHypothetique === null ? '' : LIBELLES_FONCTIONS[entree.fonctionHypothetique],
      entree.auteur,
    ]
    lignes.push(cellules.map(echapperCelluleCSV).join(SEPARATEUR_CSV))
  }
  return `﻿${lignes.join('\r\n')}`
}

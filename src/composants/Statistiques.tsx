import { useState } from 'react'
import { jourDeDateHeure, formaterJourISO } from '../dates'
import {
  compterParHeure,
  compterParLieu,
  compterParPersonnePresente,
  compterParType,
} from '../statistiques'
import type { ComptageParLibelle } from '../statistiques'
import type { EntreeABC, TypeComportement } from '../types'

interface ProprietesStatistiques {
  entrees: EntreeABC[]
  typesParIdentifiant: Map<string, TypeComportement>
}

type PeriodeStatistiques = 'tout' | '30' | '90'

interface ProprietesBarresHorizontales {
  titre: string
  comptages: ComptageParLibelle[]
  couleurParLibelle?: Map<string, string>
}

function BarresHorizontales({ titre, comptages, couleurParLibelle }: ProprietesBarresHorizontales) {
  const maximum = Math.max(1, ...comptages.map((comptage) => comptage.nombre))
  return (
    <section className="carte-statistique">
      <h3>{titre}</h3>
      {comptages.length === 0 && <p className="texte-vide">Aucune donnée.</p>}
      <ul className="barres-horizontales">
        {comptages.map((comptage) => (
          <li key={comptage.libelle}>
            <span className="barre-libelle">{comptage.libelle}</span>
            <span className="barre-piste">
              <span
                className="barre-remplissage"
                style={{
                  width: `${(comptage.nombre / maximum) * 100}%`,
                  backgroundColor: couleurParLibelle?.get(comptage.libelle) ?? '#440054',
                }}
              />
            </span>
            <span className="barre-valeur">{comptage.nombre}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Statistiques({ entrees, typesParIdentifiant }: ProprietesStatistiques) {
  const [periode, setPeriode] = useState<PeriodeStatistiques>('tout')

  let entreesFiltrees = entrees
  if (periode !== 'tout') {
    const nombreJours = Number(periode)
    const dateLimite = new Date()
    dateLimite.setDate(dateLimite.getDate() - nombreJours)
    const jourLimite = formaterJourISO(dateLimite)
    entreesFiltrees = entrees.filter((entree) => jourDeDateHeure(entree.dateHeure) >= jourLimite)
  }

  const nomTypeParIdentifiant = new Map<string, string>()
  const couleurParNomType = new Map<string, string>()
  for (const [identifiant, typeComportement] of typesParIdentifiant) {
    nomTypeParIdentifiant.set(identifiant, typeComportement.nom)
    couleurParNomType.set(typeComportement.nom, typeComportement.couleur)
  }

  const comptagesParType = compterParType(entreesFiltrees, nomTypeParIdentifiant)
  const comptagesParHeure = compterParHeure(entreesFiltrees)
  const maximumParHeure = Math.max(1, ...comptagesParHeure)

  return (
    <div>
      <div className="statistiques-entete">
        <h2>Statistiques</h2>
        <label className="statistiques-periode">
          Période
          <select
            value={periode}
            onChange={(evenement) => setPeriode(evenement.target.value as PeriodeStatistiques)}
          >
            <option value="tout">Tout l'historique</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
        </label>
      </div>

      <p className="statistiques-total">
        {entreesFiltrees.length} comportement{entreesFiltrees.length > 1 ? 's' : ''} sur la période
      </p>

      <BarresHorizontales
        titre="Répartition par type"
        comptages={comptagesParType}
        couleurParLibelle={couleurParNomType}
      />

      <section className="carte-statistique">
        <h3>Fréquence par heure de la journée</h3>
        <div className="barres-verticales">
          {comptagesParHeure.map((nombre, heure) => (
            <div key={heure} className="barre-verticale-colonne" title={`${heure} h : ${nombre}`}>
              <span
                className="barre-verticale"
                style={{ height: `${(nombre / maximumParHeure) * 100}%` }}
              />
              <span className="barre-verticale-heure">{heure % 3 === 0 ? heure : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <BarresHorizontales titre="Par lieu" comptages={compterParLieu(entreesFiltrees)} />
      <BarresHorizontales
        titre="Par personne présente"
        comptages={compterParPersonnePresente(entreesFiltrees)}
      />
    </div>
  )
}

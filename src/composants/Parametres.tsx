import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { construireCSV } from '../csv'
import {
  construireSauvegarde,
  creerType,
  ecrireParametre,
  effacerToutesLesDonnees,
  importerSauvegarde,
  modifierType,
  parametresConnus,
  renommerProfil,
  supprimerProfil,
  supprimerType,
} from '../depot'
import { formaterJourISO } from '../dates'
import {
  dechiffrerSauvegarde,
  lireContenuFichier,
  serialiserSauvegarde,
} from '../sauvegarde'
import { telechargerTexte } from '../telechargement'
import type { EnveloppeChiffree, EntreeABC, Profil, TypeComportement } from '../types'

interface ProprietesParametres {
  profils: Profil[]
  profilActifId: string
  typesComportement: TypeComportement[]
  entreesDuProfilActif: EntreeABC[]
  auteur: string
  onAuteurChange: (nouvelAuteur: string) => void
}

export function Parametres({
  profils,
  profilActifId,
  typesComportement,
  entreesDuProfilActif,
  auteur,
  onAuteurChange,
}: ProprietesParametres) {
  const [nomNouveauType, setNomNouveauType] = useState('')
  const [couleurNouveauType, setCouleurNouveauType] = useState('#6366f1')
  const [motDePasseExport, setMotDePasseExport] = useState('')
  const [enveloppeEnAttente, setEnveloppeEnAttente] = useState<EnveloppeChiffree | null>(null)
  const [motDePasseImport, setMotDePasseImport] = useState('')
  const [message, setMessage] = useState('')

  async function ajouterType() {
    const nomNettoye = nomNouveauType.trim()
    if (nomNettoye === '') {
      return
    }
    const existeDeja = typesComportement.some(
      (typeComportement) => typeComportement.nom.toLowerCase() === nomNettoye.toLowerCase(),
    )
    if (existeDeja) {
      setMessage('Ce type de comportement existe déjà.')
      return
    }
    await creerType(nomNettoye, couleurNouveauType)
    setNomNouveauType('')
    setMessage('')
  }

  async function exporterJSON() {
    const sauvegarde = await construireSauvegarde()
    const motDePasse = motDePasseExport === '' ? null : motDePasseExport
    const contenu = await serialiserSauvegarde(sauvegarde, motDePasse)
    const suffixe = motDePasse === null ? '' : '-chiffre'
    const nomFichier = `suivi-abc-${formaterJourISO(new Date())}${suffixe}.json`
    telechargerTexte(nomFichier, contenu, 'application/json')
    setMessage(
      motDePasse === null
        ? 'Sauvegarde exportée (non chiffrée).'
        : 'Sauvegarde exportée et chiffrée.',
    )
  }

  async function exporterCSV() {
    const contenu = construireCSV(entreesDuProfilActif, profils, typesComportement)
    const nomFichier = `suivi-abc-${formaterJourISO(new Date())}.csv`
    telechargerTexte(nomFichier, contenu, 'text/csv')
    setMessage('CSV exporté pour le profil actif.')
  }

  async function gererChoixFichier(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0]
    evenement.target.value = ''
    if (fichier === undefined) {
      return
    }
    try {
      const texteFichier = await fichier.text()
      const contenuLu = lireContenuFichier(texteFichier)
      if (contenuLu.type === 'chiffre') {
        setEnveloppeEnAttente(contenuLu.enveloppe)
        setMessage('Fichier chiffré : saisissez le mot de passe pour l\'importer.')
        return
      }
      const resume = await importerSauvegarde(contenuLu.sauvegarde)
      setMessage(
        `Import terminé : ${resume.entrees} nouveau(x) comportement(s), ${resume.profils} nouveau(x) profil(s).`,
      )
    } catch (erreur) {
      setMessage(erreur instanceof Error ? erreur.message : "Échec de l'import.")
    }
  }

  async function importerFichierChiffre() {
    if (enveloppeEnAttente === null) {
      return
    }
    try {
      const sauvegarde = await dechiffrerSauvegarde(enveloppeEnAttente, motDePasseImport)
      const resume = await importerSauvegarde(sauvegarde)
      setEnveloppeEnAttente(null)
      setMotDePasseImport('')
      setMessage(
        `Import terminé : ${resume.entrees} nouveau(x) comportement(s), ${resume.profils} nouveau(x) profil(s).`,
      )
    } catch (erreur) {
      setMessage(erreur instanceof Error ? erreur.message : "Échec de l'import.")
    }
  }

  async function toutEffacer() {
    const confirme = window.confirm(
      'Supprimer TOUTES les données de cet appareil (profils, types, comportements) ? Cette action est irréversible.',
    )
    if (!confirme) {
      return
    }
    await effacerToutesLesDonnees()
    window.location.reload()
  }

  async function modifierCodeProfil(profil: Profil) {
    const nouveauCode = window.prompt('Nouveau code du profil :', profil.code)
    if (nouveauCode === null || nouveauCode.trim() === '') {
      return
    }
    await renommerProfil(profil.id, nouveauCode)
  }

  async function retirerProfil(profil: Profil) {
    const confirme = window.confirm(
      `Supprimer le profil « ${profil.code} » ? Ses comportements ne seront plus affichés.`,
    )
    if (!confirme) {
      return
    }
    await supprimerProfil(profil.id)
  }

  async function retirerType(typeComportement: TypeComportement) {
    const confirme = window.confirm(
      `Supprimer le type « ${typeComportement.nom} » ? Les anciens comportements garderont ce type.`,
    )
    if (!confirme) {
      return
    }
    await supprimerType(typeComportement.id)
  }

  async function enregistrerAuteur(nouvelAuteur: string) {
    await ecrireParametre(parametresConnus.auteur, nouvelAuteur.trim())
  }

  return (
    <div className="parametres">
      {message !== '' && <p className="message-information">{message}</p>}

      <section className="carte-statistique">
        <h3>Votre nom (auteur des saisies)</h3>
        <input
          type="text"
          value={auteur}
          onChange={(evenement) => onAuteurChange(evenement.target.value)}
          onBlur={(evenement) => enregistrerAuteur(evenement.target.value)}
        />
      </section>

      <section className="carte-statistique">
        <h3>Profils</h3>
        <ul className="liste-gestion">
          {profils.map((profil) => (
            <li key={profil.id}>
              <span>
                {profil.code}
                {profil.id === profilActifId ? ' (actif)' : ''}
              </span>
              <span className="liste-gestion-actions">
                <button
                  type="button"
                  className="bouton-secondaire"
                  onClick={() => modifierCodeProfil(profil)}
                >
                  Renommer
                </button>
                <button
                  type="button"
                  className="bouton-danger"
                  onClick={() => retirerProfil(profil)}
                >
                  Supprimer
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="carte-statistique">
        <h3>Types de comportements</h3>
        <ul className="liste-gestion">
          {typesComportement.map((typeComportement) => (
            <li key={typeComportement.id}>
              <span className="liste-gestion-edition">
                <input
                  type="color"
                  value={typeComportement.couleur}
                  onChange={(evenement) =>
                    modifierType(typeComportement.id, { couleur: evenement.target.value })
                  }
                  aria-label={`Couleur de ${typeComportement.nom}`}
                />
                <input
                  type="text"
                  defaultValue={typeComportement.nom}
                  onBlur={(evenement) => {
                    const nomNettoye = evenement.target.value.trim()
                    if (nomNettoye !== '' && nomNettoye !== typeComportement.nom) {
                      modifierType(typeComportement.id, { nom: nomNettoye })
                    }
                  }}
                  aria-label="Nom du type"
                />
              </span>
              <button
                type="button"
                className="bouton-danger"
                onClick={() => retirerType(typeComportement)}
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
        <div className="ajout-type">
          <input
            type="color"
            value={couleurNouveauType}
            onChange={(evenement) => setCouleurNouveauType(evenement.target.value)}
            aria-label="Couleur du nouveau type"
          />
          <input
            type="text"
            placeholder="Nom du nouveau type"
            value={nomNouveauType}
            onChange={(evenement) => setNomNouveauType(evenement.target.value)}
          />
          <button type="button" className="bouton-principal" onClick={ajouterType}>
            Ajouter
          </button>
        </div>
      </section>

      <section className="carte-statistique">
        <h3>Sauvegarde et transfert entre appareils</h3>
        <label>
          Mot de passe de chiffrement (facultatif)
          <input
            type="password"
            autoComplete="new-password"
            value={motDePasseExport}
            onChange={(evenement) => setMotDePasseExport(evenement.target.value)}
          />
        </label>
        <p className="texte-aide">
          Sans mot de passe, le fichier contient les données en clair. Un mot de passe perdu rend
          le fichier chiffré irrécupérable.
        </p>
        <div className="formulaire-actions">
          <button type="button" className="bouton-principal" onClick={exporterJSON}>
            Exporter en JSON
          </button>
          <button type="button" className="bouton-secondaire" onClick={exporterCSV}>
            Exporter en CSV (profil actif)
          </button>
        </div>

        <label className="champ-fichier">
          Importer un fichier JSON (fusion avec les données existantes)
          <input type="file" accept="application/json,.json" onChange={gererChoixFichier} />
        </label>

        {enveloppeEnAttente !== null && (
          <div className="import-chiffre">
            <label>
              Mot de passe du fichier importé
              <input
                type="password"
                autoComplete="off"
                value={motDePasseImport}
                onChange={(evenement) => setMotDePasseImport(evenement.target.value)}
              />
            </label>
            <button type="button" className="bouton-principal" onClick={importerFichierChiffre}>
              Déchiffrer et importer
            </button>
          </div>
        )}
      </section>

      <section className="carte-statistique">
        <h3>Zone sensible</h3>
        <button type="button" className="bouton-danger" onClick={toutEffacer}>
          Supprimer toutes les données de cet appareil
        </button>
      </section>
    </div>
  )
}

// Lien d'invitation : https://…/suivi-abc/?rejoindre=<identifiant du fichier Drive>&profil=<code>
// Le mot de passe du profil peut être ajouté dans le fragment (#mdp=…) : il n'est alors jamais envoyé
// à un serveur par le navigateur, mais il figure dans le message qui contient le lien.

const CLE_INVITATION = 'suiviAbcInvitation'
const FORME_IDENTIFIANT_FICHIER = /^[A-Za-z0-9_-]{10,120}$/
const LONGUEUR_MAXIMALE_CODE = 60
const LONGUEUR_MAXIMALE_MOT_DE_PASSE = 200

export interface Invitation {
  identifiantFichier: string
  codeProfil: string
  // Présent seulement si le lien contient le mot de passe.
  motDePasse: string | null
}

export function construireLienInvitation(
  adresseDeBase: string,
  identifiantFichier: string,
  codeProfil: string,
  motDePasse: string | null = null,
): string {
  const adresse = new URL(adresseDeBase)
  adresse.search = ''
  adresse.hash = ''
  adresse.searchParams.set('rejoindre', identifiantFichier)
  adresse.searchParams.set('profil', codeProfil)
  if (motDePasse !== null && motDePasse !== '') {
    adresse.hash = new URLSearchParams({ mdp: motDePasse }).toString()
  }
  return adresse.toString()
}

export function analyserInvitation(recherche: string, fragment = ''): Invitation | null {
  const parametres = new URLSearchParams(recherche.replace(/^\?/, ''))
  const identifiantFichier = parametres.get('rejoindre')
  if (identifiantFichier === null || !FORME_IDENTIFIANT_FICHIER.test(identifiantFichier)) {
    return null
  }
  const codeProfil = (parametres.get('profil') ?? '').trim().slice(0, LONGUEUR_MAXIMALE_CODE)
  const motDePasseLu = new URLSearchParams(fragment.replace(/^#/, '')).get('mdp') ?? ''
  const motDePasse =
    motDePasseLu !== '' && motDePasseLu.length <= LONGUEUR_MAXIMALE_MOT_DE_PASSE ? motDePasseLu : null
  return { identifiantFichier, codeProfil, motDePasse }
}

// Analyse une valeur lue dans le stockage de session (pur, testable).
export function analyserInvitationMemorisee(brut: string | null): Invitation | null {
  if (brut === null) {
    return null
  }
  try {
    const contenu = JSON.parse(brut) as {
      identifiantFichier?: unknown
      codeProfil?: unknown
      motDePasse?: unknown
    }
    if (
      typeof contenu.identifiantFichier !== 'string' ||
      !FORME_IDENTIFIANT_FICHIER.test(contenu.identifiantFichier)
    ) {
      return null
    }
    return {
      identifiantFichier: contenu.identifiantFichier,
      codeProfil: typeof contenu.codeProfil === 'string' ? contenu.codeProfil : '',
      motDePasse:
        typeof contenu.motDePasse === 'string' && contenu.motDePasse !== '' ? contenu.motDePasse : null,
    }
  } catch {
    return null
  }
}

export function lireInvitationMemorisee(): Invitation | null {
  try {
    return analyserInvitationMemorisee(sessionStorage.getItem(CLE_INVITATION))
  } catch {
    return null
  }
}

export function oublierInvitation(): void {
  try {
    sessionStorage.removeItem(CLE_INVITATION)
  } catch {
    // Stockage indisponible : rien à nettoyer.
  }
}

// À appeler au chargement de la page. L'invitation est gardée pour l'onglet courant (elle survit à
// l'aller-retour chez Google sur iPhone), puis retirée de l'adresse (mot de passe compris).
export function capturerInvitationDansLaPage(): void {
  const invitation = analyserInvitation(location.search, location.hash)
  if (invitation === null) {
    return
  }
  try {
    sessionStorage.setItem(CLE_INVITATION, JSON.stringify(invitation))
  } catch {
    // Stockage indisponible : l'invitation ne sera pas retrouvée après un rechargement.
  }
  history.replaceState(null, '', location.pathname)
}

// Connexion Google par redirection (page entière) au lieu d'une fenêtre popup.
// Nécessaire sur iPhone/iPad : Safari coupe le lien entre la popup Google et l'application,
// ce qui laisse une page blanche (accounts.google.com/gsi/transform).

const CLE_ETAT_OAUTH = 'suiviAbcEtatOauth'
const CLE_CONNEXION_EN_ATTENTE = 'suiviAbcConnexionEnAttente'

export type RetourRedirection =
  | { type: 'aucun' }
  | { type: 'jeton'; jeton: string; dureeSecondes: number }
  | { type: 'erreur'; message: string }

// Pur : facile à tester. Le paramètre ?connexion=redirection force ce mode pour les essais.
export function navigateurNecessiteRedirection(
  agentUtilisateur: string,
  plateforme: string,
  nombrePointsTactiles: number,
  recherche: string,
): boolean {
  if (new URLSearchParams(recherche).get('connexion') === 'redirection') {
    return true
  }
  const estIphoneOuIpod = /iPhone|iPod|iPad/.test(agentUtilisateur)
  // Les iPad récents se présentent comme des Mac, mais ont un écran tactile.
  const estIpadSousFauxNomDeMac = plateforme === 'MacIntel' && nombrePointsTactiles > 1
  return estIphoneOuIpod || estIpadSousFauxNomDeMac
}

export function doitUtiliserRedirection(): boolean {
  return navigateurNecessiteRedirection(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints,
    location.search,
  )
}

// L'adresse de retour doit être déclarée à l'identique dans Google Cloud.
export function adresseDeRetour(origine: string, chemin: string): string {
  return origine + chemin.replace(/index\.html$/, '')
}

export function construireUrlConnexionGoogle(
  identifiantClient: string,
  adresseRetour: string,
  portees: string,
  etat: string,
): string {
  const adresse = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  adresse.searchParams.set('client_id', identifiantClient)
  adresse.searchParams.set('redirect_uri', adresseRetour)
  adresse.searchParams.set('response_type', 'token')
  adresse.searchParams.set('scope', portees)
  adresse.searchParams.set('include_granted_scopes', 'true')
  adresse.searchParams.set('state', etat)
  return adresse.toString()
}

// Google renvoie le jeton dans le fragment (#…) et, selon les cas, les erreurs dans la requête (?…).
export function analyserRetourRedirection(
  fragment: string,
  requete: string,
  etatAttendu: string | null,
): RetourRedirection {
  const parametres = new URLSearchParams(requete.replace(/^\?/, ''))
  new URLSearchParams(fragment.replace(/^#/, '')).forEach((valeur, cle) => {
    parametres.set(cle, valeur)
  })

  const etatRecu = parametres.get('state')
  if (etatAttendu === null || etatRecu === null || etatRecu !== etatAttendu) {
    return { type: 'aucun' }
  }

  const erreur = parametres.get('error')
  if (erreur !== null) {
    return { type: 'erreur', message: erreur }
  }

  const jeton = parametres.get('access_token')
  if (jeton === null || jeton === '') {
    return { type: 'erreur', message: 'pas de jeton' }
  }

  const dureeSecondes = Number(parametres.get('expires_in') ?? '3600')
  return {
    type: 'jeton',
    jeton,
    dureeSecondes: Number.isFinite(dureeSecondes) && dureeSecondes > 0 ? dureeSecondes : 3600,
  }
}

function lireSession(cle: string): string | null {
  try {
    return sessionStorage.getItem(cle)
  } catch {
    return null
  }
}

function ecrireSession(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) {
      sessionStorage.removeItem(cle)
    } else {
      sessionStorage.setItem(cle, valeur)
    }
  } catch {
    // Stockage indisponible (navigation privée stricte) : la redirection échouera proprement.
  }
}

export function demarrerRedirectionGoogle(
  identifiantClient: string,
  portees: string,
): void {
  const etat = crypto.randomUUID()
  ecrireSession(CLE_ETAT_OAUTH, etat)
  const retour = adresseDeRetour(location.origin, location.pathname)
  location.assign(construireUrlConnexionGoogle(identifiantClient, retour, portees, etat))
}

// À appeler une seule fois au chargement de la page. Nettoie l'adresse dans tous les cas.
export function lireRetourRedirectionDansLaPage(): RetourRedirection {
  const etatAttendu = lireSession(CLE_ETAT_OAUTH)
  const retour = analyserRetourRedirection(location.hash, location.search, etatAttendu)
  if (retour.type !== 'aucun') {
    ecrireSession(CLE_ETAT_OAUTH, null)
    // Retire le jeton de l'adresse (historique, copier-coller…).
    history.replaceState(null, '', location.pathname)
  }
  return retour
}

// Le mot de passe de chiffrement saisi avant la redirection est gardé le temps de l'aller-retour
// (onglet courant uniquement), puis supprimé dès la lecture.
export function memoriserConnexionEnAttente(motDePasse: string): void {
  ecrireSession(CLE_CONNEXION_EN_ATTENTE, JSON.stringify({ motDePasse }))
}

export function recupererConnexionEnAttente(): string | null {
  const brut = lireSession(CLE_CONNEXION_EN_ATTENTE)
  ecrireSession(CLE_CONNEXION_EN_ATTENTE, null)
  if (brut === null) {
    return null
  }
  try {
    const contenu = JSON.parse(brut) as { motDePasse?: unknown }
    return typeof contenu.motDePasse === 'string' && contenu.motDePasse !== ''
      ? contenu.motDePasse
      : null
  } catch {
    return null
  }
}

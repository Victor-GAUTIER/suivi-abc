export type IdentifiantTheme = 'auto' | 'violet' | 'ocean' | 'foret' | 'sombre' | 'contraste'
export type ThemeAffiche = Exclude<IdentifiantTheme, 'auto'>

export interface DescriptionTheme {
  identifiant: IdentifiantTheme
  libelle: string
  // Trois couleurs pour l'aperçu : barre, fond, accent.
  apercu: [string, string, string]
}

export const THEMES: DescriptionTheme[] = [
  { identifiant: 'auto', libelle: "Automatique (suit l'appareil)", apercu: ['#440054', '#14111a', '#d2a8e6'] },
  { identifiant: 'violet', libelle: 'Violet', apercu: ['#440054', '#f8f9fa', '#5d0073'] },
  { identifiant: 'ocean', libelle: 'Océan', apercu: ['#0b4f8a', '#f4f8fc', '#1366b0'] },
  { identifiant: 'foret', libelle: 'Forêt', apercu: ['#1f5c3a', '#f5faf6', '#2a7a4e'] },
  { identifiant: 'sombre', libelle: 'Sombre', apercu: ['#2a1236', '#14111a', '#d2a8e6'] },
  { identifiant: 'contraste', libelle: 'Contraste élevé', apercu: ['#000000', '#ffffff', '#0000a0'] },
]

// Couleur de la barre du navigateur (mobile), par thème affiché.
const COULEUR_BARRE_NAVIGATEUR: Record<ThemeAffiche, string> = {
  violet: '#440054',
  ocean: '#0b4f8a',
  foret: '#1f5c3a',
  sombre: '#2a1236',
  contraste: '#000000',
}

const CLE_STOCKAGE = 'suiviAbcTheme'

export function normaliserTheme(valeur: string | null | undefined): IdentifiantTheme {
  const trouve = THEMES.find((theme) => theme.identifiant === valeur)
  return trouve?.identifiant ?? 'violet'
}

export function resoudreTheme(choix: IdentifiantTheme, appareilEnModeSombre: boolean): ThemeAffiche {
  if (choix === 'auto') {
    return appareilEnModeSombre ? 'sombre' : 'violet'
  }
  return choix
}

export function lireThemeMemorise(): IdentifiantTheme {
  try {
    return normaliserTheme(localStorage.getItem(CLE_STOCKAGE))
  } catch {
    return 'violet'
  }
}

function appareilEnModeSombre(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function afficherTheme(choix: IdentifiantTheme): void {
  const theme = resoudreTheme(choix, appareilEnModeSombre())
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', COULEUR_BARRE_NAVIGATEUR[theme])
}

let choixCourant: IdentifiantTheme = 'violet'

export function appliquerTheme(choix: IdentifiantTheme): void {
  choixCourant = choix
  try {
    localStorage.setItem(CLE_STOCKAGE, choix)
  } catch {
    // Stockage indisponible : le thème s'applique quand même pour cette session.
  }
  afficherTheme(choix)
}

// À appeler avant l'affichage de l'application, pour éviter un flash de la mauvaise couleur.
export function initialiserTheme(): void {
  choixCourant = lireThemeMemorise()
  afficherTheme(choixCourant)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (choixCourant === 'auto') {
      afficherTheme('auto')
    }
  })
}

export function telechargerTexte(nomFichier: string, contenu: string, typeMime: string): void {
  const blob = new Blob([contenu], { type: `${typeMime};charset=utf-8` })
  const adresseTemporaire = URL.createObjectURL(blob)
  const lien = document.createElement('a')
  lien.href = adresseTemporaire
  lien.download = nomFichier
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)
  URL.revokeObjectURL(adresseTemporaire)
}

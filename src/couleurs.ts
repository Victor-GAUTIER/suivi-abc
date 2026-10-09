export function couleurTexteLisible(couleurFondHexadecimale: string): string {
  const valeurSansDiese = couleurFondHexadecimale.replace('#', '')
  const rouge = Number.parseInt(valeurSansDiese.slice(0, 2), 16)
  const vert = Number.parseInt(valeurSansDiese.slice(2, 4), 16)
  const bleu = Number.parseInt(valeurSansDiese.slice(4, 6), 16)
  const luminance = (0.299 * rouge + 0.587 * vert + 0.114 * bleu) / 255
  return luminance < 0.5 ? '#ffffff' : '#1f2933'
}

import { describe, expect, it } from 'vitest'
import { normaliserTheme, resoudreTheme } from './themes'

describe('normaliserTheme', () => {
  it('garde un thème connu', () => {
    expect(normaliserTheme('sombre')).toBe('sombre')
    expect(normaliserTheme('auto')).toBe('auto')
  })

  it('revient au violet pour une valeur inconnue ou absente', () => {
    expect(normaliserTheme('rose')).toBe('violet')
    expect(normaliserTheme(null)).toBe('violet')
    expect(normaliserTheme(undefined)).toBe('violet')
  })
})

describe('resoudreTheme', () => {
  it('suit le mode de l\'appareil en automatique', () => {
    expect(resoudreTheme('auto', true)).toBe('sombre')
    expect(resoudreTheme('auto', false)).toBe('violet')
  })

  it('ignore le mode de l\'appareil pour un thème choisi', () => {
    expect(resoudreTheme('ocean', true)).toBe('ocean')
    expect(resoudreTheme('contraste', false)).toBe('contraste')
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { hasCompletedVoiceCheck, markVoiceCheckDone, resetVoiceCheckForTests, VOICE_CHECK_STORAGE_KEY } from './storage'

afterEach(() => {
  window.localStorage.clear()
})

describe('hasCompletedVoiceCheck / markVoiceCheckDone', () => {
  it('renvoie false par défaut (rien en localStorage)', () => {
    resetVoiceCheckForTests()
    expect(hasCompletedVoiceCheck()).toBe(false)
  })

  it('renvoie true après markVoiceCheckDone()', () => {
    resetVoiceCheckForTests()
    markVoiceCheckDone()
    expect(hasCompletedVoiceCheck()).toBe(true)
    expect(window.localStorage.getItem(VOICE_CHECK_STORAGE_KEY)).toBe('1')
  })

  it('utilise une clé distincte de STORAGE_KEY de src/save (pas de collision avec la sauvegarde de jeu)', () => {
    expect(VOICE_CHECK_STORAGE_KEY).not.toBe('royaume-des-sons:save')
  })
})

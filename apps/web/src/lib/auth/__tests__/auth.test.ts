import { beforeEach, describe, expect, it } from 'vitest'
import { createLocalAuthProvider } from '../index'

describe('local auth provider', () => {
  beforeEach(() => window.localStorage.clear())

  it('has nobody signed in before the first sign-in', () => {
    expect(createLocalAuthProvider().getCurrentUser()).toBeNull()
  })

  it('keeps the session across provider instances', async () => {
    await createLocalAuthProvider().signIn('ana@example.br', 'secret')

    expect(createLocalAuthProvider().getCurrentUser()?.email).toBe('ana@example.br')
  })

  it('signs up with the teacher role', async () => {
    const user = await createLocalAuthProvider().signUp('Ana', 'ana@example.br', 'secret')

    expect(user.role).toBe('professor')
    expect(user.fullName).toBe('Ana')
  })

  it('clears the session on sign out', async () => {
    const auth = createLocalAuthProvider()
    await auth.signIn('ana@example.br', 'secret')

    await auth.signOut()

    expect(auth.getCurrentUser()).toBeNull()
  })

  it('returns null instead of throwing when the stored session is corrupt', () => {
    window.localStorage.setItem('correctio:v1:session', 'not json')

    expect(createLocalAuthProvider().getCurrentUser()).toBeNull()
  })
})

import { signInSchema } from '@correctio/domain'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api-error'
import { parseRequest } from '../parse-request'

describe('parseRequest', () => {
  it('answers the validated data', () => {
    expect(parseRequest(signInSchema, { email: ' ana@exemplo.edu.br ', password: 'x' })).toEqual({
      email: 'ana@exemplo.edu.br',
      password: 'x',
    })
  })

  it('refuses with the message of the schema, the same the form shows', () => {
    const refusal = (() => {
      try {
        parseRequest(signInSchema, { email: 'nao-e-email', password: 'x' })
      } catch (error) {
        return error
      }
    })()

    expect(refusal).toBeInstanceOf(ApiError)
    expect(refusal).toMatchObject({ code: 'invalid', message: 'Informe um e-mail válido' })
  })
})

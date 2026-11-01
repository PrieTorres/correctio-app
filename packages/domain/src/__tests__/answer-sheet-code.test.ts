import { describe, expect, it } from 'vitest'
import { ANSWER_SHEET_CODE, answerSheetCodeFromQr, createAnswerSheetCode, isAnswerSheetCode } from '../answer-sheet-code'

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ27'

describe('createAnswerSheetCode', () => {
  it('is 26 characters long and never repeats', () => {
    const codes = new Set(Array.from({ length: 1000 }, createAnswerSheetCode))
    expect(codes.size).toBe(1000)
    codes.forEach((code) => expect(code).toHaveLength(26))
  })

  it('avoids characters that are ambiguous on printed paper, so the reading of the photo accepts it', () => {
    const code = createAnswerSheetCode()

    expect(code).toMatch(/^[A-Z2-7]{26}$/)
    expect(isAnswerSheetCode(code)).toBe(true)
  })
})

describe('isAnswerSheetCode', () => {
  it('accepts 26 symbols of the printed alphabet', () => {
    expect(CODE).toHaveLength(ANSWER_SHEET_CODE.LENGTH)
    expect(isAnswerSheetCode(CODE)).toBe(true)
  })

  it('refuses the digits that read ambiguously on paper, lower case and another length', () => {
    expect(isAnswerSheetCode(`${CODE.slice(0, 25)}0`)).toBe(false)
    expect(isAnswerSheetCode(`${CODE.slice(0, 25)}8`)).toBe(false)
    expect(isAnswerSheetCode(CODE.toLowerCase())).toBe(false)
    expect(isAnswerSheetCode(CODE.slice(1))).toBe(false)
  })
})

describe('answerSheetCodeFromQr', () => {
  it('reads the bare code', () => {
    expect(answerSheetCodeFromQr(` ${CODE}\n`)).toBe(CODE)
  })

  it('reads the public lookup address on any domain, with or without the trailing slash or a query', () => {
    expect(answerSheetCodeFromQr(`https://correctio-app.web.app/r/${CODE}`)).toBe(CODE)
    expect(answerSheetCodeFromQr(`https://prietorres.github.io/correctio-app/r/${CODE}/`)).toBe(CODE)
    expect(answerSheetCodeFromQr(`https://outro-host.example/r/${CODE}?v=2`)).toBe(CODE)
    expect(answerSheetCodeFromQr(`/r/${CODE}`)).toBe(CODE)
  })

  it('answers null for anything else a QR Code may hold', () => {
    expect(answerSheetCodeFromQr('https://correctio-app.web.app/turmas')).toBeNull()
    expect(answerSheetCodeFromQr(`https://correctio-app.web.app/r/${CODE.toLowerCase()}`)).toBeNull()
    expect(answerSheetCodeFromQr('texto qualquer')).toBeNull()
    expect(answerSheetCodeFromQr('http://[::1')).toBeNull()
    expect(answerSheetCodeFromQr('')).toBeNull()
  })
})

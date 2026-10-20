import { describe, expect, it } from 'vitest'
import { ANSWER_SHEET_CODE, answerSheetCodeFromQr, isAnswerSheetCode } from '../answer-sheet-code'

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ27'

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

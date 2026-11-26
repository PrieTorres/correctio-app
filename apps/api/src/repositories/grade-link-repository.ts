import type { Kysely } from 'kysely'
import type { FieldCipher } from '../lib/field-encryption'
import type { Database } from '../models/tables'

/** One student of the class, with what is needed to decide whether an e-mail can go to them. */
export interface GradeLinkRecipient {
  fullName: string
  anonymized: boolean
  removed: boolean
  /** Present only for a student who is still in the class, not anonymized, and holds a sheet. */
  email?: string
  /** The printed code of the student's sheet in this application, which is the whole credential of the public lookup. */
  sheetCode?: string
}

export interface GradeLinkRepository {
  /** Every student of the class, removed ones included, so the summary can say how many were left out. */
  findRecipients: (applicationId: string, classId: string) => Promise<GradeLinkRecipient[]>
}

/**
 * Reads who can be written to about an application. A sheet belongs to a
 * student either from the printing (identified exams) or from the correction
 * that assigned one, which is the order the public lookup follows too. A
 * student with two sheets gets the lowest number, so one e-mail goes to one
 * student. The address is decrypted here, and only for a student the e-mail
 * can actually reach, so no other path holds a plain address.
 */
export function createGradeLinkRepository(db: Kysely<Database>, cipher: FieldCipher): GradeLinkRepository {
  const sheetCodesByStudent = async (applicationId: string): Promise<Map<string, string>> => {
    const printed = await db
      .selectFrom('answer_sheets')
      .select(['studentId', 'code', 'sheetNumber'])
      .where('applicationId', '=', applicationId)
      .where('studentId', 'is not', null)
      .execute()
    const assigned = await db
      .selectFrom('corrections')
      .innerJoin('answer_sheets', 'answer_sheets.id', 'corrections.answerSheetId')
      .select(['corrections.studentId as studentId', 'answer_sheets.code as code', 'answer_sheets.sheetNumber as sheetNumber'])
      .where('answer_sheets.applicationId', '=', applicationId)
      .where('answer_sheets.studentId', 'is', null)
      .where('corrections.studentId', 'is not', null)
      .execute()

    const lowest = new Map<string, { code: string; sheetNumber: number }>()
    for (const { studentId, code, sheetNumber } of [...printed, ...assigned]) {
      if (studentId === null) continue
      const known = lowest.get(studentId)
      if (known === undefined || sheetNumber < known.sheetNumber) lowest.set(studentId, { code, sheetNumber })
    }
    return new Map([...lowest].map(([studentId, { code }]) => [studentId, code]))
  }

  return {
    async findRecipients(applicationId, classId) {
      const [students, codes] = await Promise.all([
        db
          .selectFrom('students')
          .select(['id', 'fullName', 'email', 'anonymizedAt', 'removedAt'])
          .where('classId', '=', classId)
          .orderBy('fullName')
          .orderBy('id')
          .execute(),
        sheetCodesByStudent(applicationId),
      ])

      return students.map((student) => {
        const anonymized = student.anonymizedAt !== null
        const removed = student.removedAt !== null
        const sheetCode = codes.get(student.id)
        const email = !anonymized && !removed && sheetCode !== undefined ? student.email : null
        return {
          fullName: student.fullName,
          anonymized,
          removed,
          ...(sheetCode !== undefined && { sheetCode }),
          ...(email !== null && { email: cipher.decrypt(email) }),
        }
      })
    },
  }
}

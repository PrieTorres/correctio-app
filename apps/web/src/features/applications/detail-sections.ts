import { buildPath, ROUTES } from '@/app/routes'

/** The cards of the detail (P14) a link can land on, by the `id` each card carries. */
export const DETAIL_SECTION = Object.freeze({ VERSIONS: 'versoes', GRADES: 'notas' } as const)

export type DetailSection = (typeof DETAIL_SECTION)[keyof typeof DETAIL_SECTION]

/** The detail of an application, landing on one of its cards when given. */
export function applicationDetailPath(id: string, section?: DetailSection): string {
  const path = buildPath(ROUTES.applicationDetail, { id })
  return section === undefined ? path : `${path}#${section}`
}

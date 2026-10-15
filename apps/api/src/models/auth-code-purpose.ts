/**
 * What a one-time code of the sign-in flows is for. The values are the group's,
 * so they go in SCREAMING_SNAKE_CASE and are read from this object, never
 * written as loose strings where they are used.
 */
export const AUTH_CODE_PURPOSE = Object.freeze({
  PASSWORD_RESET: 'PASSWORD_RESET',
  GOOGLE_SIGN_IN: 'GOOGLE_SIGN_IN',
} as const)

export type AuthCodePurpose = (typeof AUTH_CODE_PURPOSE)[keyof typeof AUTH_CODE_PURPOSE]

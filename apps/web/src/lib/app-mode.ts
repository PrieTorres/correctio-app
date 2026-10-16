/**
 * The GitHub Pages build, which has no API: anyone signs in as the demo
 * teacher, sample data loads on the first visit and the screens offer to
 * reload or clear it. The Firebase builds, production and preview alike, never
 * set it, so they run on the real sign-in with nothing made up.
 *
 * Vite writes the value into the bundle as a constant, so every branch that
 * depends on it is decided at build time and the demo code is left out of the
 * Firebase bundle instead of merely hidden.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

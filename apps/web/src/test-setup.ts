import '@testing-library/jest-dom/vitest'

/**
 * jsdom lays nothing out, so it leaves `scrollIntoView` unimplemented. The
 * guided tour scrolls to the element each step points at, and without this
 * every screen that mounts it would crash in a unit test the moment it opened.
 */
Element.prototype.scrollIntoView = () => undefined

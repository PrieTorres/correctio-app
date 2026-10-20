import { createBaseConfig } from '../../tooling/eslint/base.js';

/** The shared rules, with nothing specific to add: the reader runs the same in the browser and in Node. */
export default createBaseConfig({ tsconfigRootDir: import.meta.dirname });

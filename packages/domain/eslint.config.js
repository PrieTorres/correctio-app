import { createBaseConfig } from '../../tooling/eslint/base.js';

/** The shared rules, with nothing specific to add: the package has no runtime of its own. */
export default createBaseConfig({ tsconfigRootDir: import.meta.dirname });

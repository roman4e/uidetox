import { uidetox } from './plugin.js';

export default uidetox;
export { uidetox, uidetoxEsbuild, createUidetoxCore } from './plugin.js';
export type { UidetoxPluginOptions } from './plugin.js';
export { compileModule, isComponentSource } from './compile.js';
export { isDottedSpecifier, resolveDottedModule } from './resolve.js';
export { generateTsShim } from './shim.js';
export { createTagRegistry } from './tags.js';

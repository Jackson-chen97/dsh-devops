/**
 * Ambient type declarations for DSH-internal packages that are not published
 * to npm. These provide minimal typing for `tsc --noEmit` during development.
 * At runtime, the DSH host provides these modules.
 */

declare module '@deepseek-ai/dsh-tools' {
  export function defineTool(tool: any): any
}

declare module '@deepseek-ai/schemastery' {
  type Schema<T = any> = T
  const Schema: any
  export default Schema
}

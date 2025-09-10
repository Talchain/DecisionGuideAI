declare module 'jest-axe' {
  export const axe: (container: Element | DocumentFragment, options?: any) => Promise<any>
  export const toHaveNoViolations: (results: any) => { pass: boolean; message(): string }
}

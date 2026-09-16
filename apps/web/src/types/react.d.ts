declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type FC<P = any> = (props: P) => any;
  export type FormEvent<T = any> = any;
  export interface Context<T> {
    Provider: any;
    _currentValue?: T;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  const React: any;
  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

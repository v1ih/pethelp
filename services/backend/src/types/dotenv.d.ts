declare module 'dotenv' {
  export function config(): void;

  const dotenv: {
    config: typeof config;
  };

  export default dotenv;
}
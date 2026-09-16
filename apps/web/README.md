# Web App

Frontend do PetHelp em React, Vite e TypeScript.

## Estrutura

```text
apps/web/
|-- package.json
|-- tsconfig.json
|-- vite.config.ts
|-- index.html
|-- default_shadcn_theme.css
`-- src/
    |-- main.tsx
    |-- app/
    |   |-- App.tsx
    |   |-- routes.tsx
    |   |-- navigation.ts
    |   |-- context/
    |   |-- screens/
    |   `-- components/
    |-- styles/
    |-- types/
    |-- global.d.ts
    `-- vite-env.d.ts
```

## Scripts

- `pnpm --filter @pet-help/web dev`
- `pnpm --filter @pet-help/web build`

## Notes

- `dist/` is generated output and should not be edited manually.
- `src/` is the source of truth for UI, routes, context and styles.
- `guidelines/` and `ATTRIBUTIONS.md` are kept as supporting documentation.

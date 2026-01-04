# React Form Builder

This project is a Vite-powered React application that turns a JSON-form configuration into a navigable form experience. Version 1 focuses on rendering `Field_Input` actions while leaving room for other action types that appear in the source data.

## Getting started

1. Install dependencies (a recent Node.js LTS release is recommended):
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the printed local URL in your browser to view the rendered form.

> **Note:** The automated environment used to build this repository cannot reach npm, so `npm install` may fail there. Run the command locally where network access is available.

## Project structure

- `src/testing/formConfigs/formConfigv1.json` – local debug/testing configuration used by debug mode.
- `src/App.tsx` – loads configuration and data, including debug-mode handling.
- `src/components/form/FormBuilder.tsx` – orchestrates steps and renders supported actions.
- `src/components/form/Step.tsx` – handles the layout for an individual step.
- `src/components/form/actions/FieldInput.tsx` – renders field input actions, including nested child actions.
- `src/testing/mocks/handlers.ts` – MSW handlers for local API mocks.
- `public/styles/styles.css` – global styles loaded after Bootstrap.

## Local testing

### Mock API responses with MSW

The app uses Mock Service Worker (MSW) in development to simulate API responses. Update or add handlers in `src/testing/mocks/handlers.ts` to mock responses locally. The service worker is started automatically in `src/main.tsx` whenever you run `npm run dev`.

### Debug mode (local config)

To bypass live data loading and use the local testing configuration, add the `debug` URL parameter:

```
http://localhost:5173/?debug=true
```

When `debug` is present, the app loads the form configuration from `src/testing/formConfigs/formConfigv1.json` and skips normal URL parameter requirements. If `debug` is not set, the standard loading flow is used.

## Automated testing (Playwright)

Playwright runs against the Vite dev server and uses debug mode for deterministic data.

1. Install Playwright browsers (one-time):
   ```bash
   npx playwright install
   ```
2. Run the tests:
   ```bash
   npm run test:e2e
   ```
   For interactive or headed runs:
   ```bash
   npm run test:e2e:ui
   npm run test:e2e:headed
   ```

## Type checking

Vite does not type-check by default. Run `npm run typecheck` for a standalone check, or use `npm run build`, which now includes type checking.

## Next steps

Future enhancements can expand support for additional action types (e.g., file uploads, table entries), integrate validation, and connect to a live data source.

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

- `src/data/formConfig.json` – sample configuration file sourced from the provided JSON.
- `src/components/FormBuilder.jsx` – orchestrates steps and renders supported actions.
- `src/components/Step.jsx` – handles the layout for an individual step.
- `src/components/fields/FieldInput.jsx` – renders field input actions, including nested child actions.
- `src/styles.css` – minimal styling to make the generated form readable.

## Next steps

Future enhancements can expand support for additional action types (e.g., file uploads, table entries), integrate validation, and connect to a live data source.

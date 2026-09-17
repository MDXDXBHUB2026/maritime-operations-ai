# Legacy Streamlit Implementation

This directory preserves the historical Streamlit Python implementation of the Maritime Operations AI Control Tower for reference and audit purposes.

## Migration Notice
As part of the production migration to a static Single-Page Application (SPA) deployed on GitHub Pages, the application architecture has been transitioned to:
- **Frontend Framework**: React 18 with TypeScript in strict mode
- **Bundler & Tooling**: Vite 6, React Router (HashRouter)
- **Styling**: Modern, responsive vanilla CSS design system
- **Deployment**: Static hosting on GitHub Pages via GitHub Actions
- **Quality & Assurance**: Vitest, React Testing Library, Playwright E2E across desktop, tablet, and mobile, ESLint, Prettier, and CI Application Assurance Platform (QA Agent, Security Agent, Finding Verifier).

## Historical Files
- `app.py`: Original Streamlit entrypoint
- `pages/`: Original Streamlit multi-page module implementations

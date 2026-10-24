# FactFinder frontend

Follow the [repository-root setup instructions](../README.md). Run `npm ci` and `npm run dev`, then open http://localhost:8080. Vite proxies API paths to http://127.0.0.1:8000.

Login requires credentials configured by the server administrator. API requests use signed HttpOnly session cookies. Do not put service/admin keys in frontend source or Vite environment variables.

Validation: `npm run build`, `npm run typecheck`, and `npm run lint`. AI-text and social-post pages are explicitly unavailable; other checks describe their evidence limits.

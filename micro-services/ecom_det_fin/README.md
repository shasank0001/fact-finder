# E-commerce compatibility entry point

Use the repository-root [setup and API documentation](../../README.md). The maintained API is `uvicorn api:app` from the root, including protected `/api/check-site`, history and feedback routes.

The old `uvicorn app.main:app` layout is no longer supported from this subdirectory. Install the root package before using compatibility imports. Configure authentication, provider keys, storage and cookies as documented at the root. No layer should be described as independent verification when it only detects a page assertion.

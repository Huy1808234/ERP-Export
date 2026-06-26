# Frontend Architecture

This project follows the Next.js App Router structure with feature-oriented UI modules and a clear split between routing, reusable UI, data access, state providers, and pure helpers.

## Folder Roles

- `src/app`: Route definitions only. Keep page/layout files thin and delegate complex UI to `components` or feature modules.
- `src/components`: Reusable UI grouped by domain (`admin`, `guest`, `auth`, `layout`, `ui`).
- `src/context`: React contexts that own local UI/application state.
- `src/providers`: App-level provider wrappers and provider helpers for external libraries.
- `src/lib`: Low-level library clients and integration primitives, such as the HTTP client and socket client.
- `src/services`: API-facing domain services. A file here may call `src/lib/api-client`.
- `src/hooks`: Reusable client hooks that compose services, session state, notifications, and UI state.
- `src/types`: Shared TypeScript types and module augmentations.
- `src/constants`: Shared constants and option maps.
- `src/utils`: Pure helpers only. Avoid API calls, React state, or framework/provider setup here.
- `src/i18n`: Locale routing and request configuration.

## Rules Of Thumb

- `app` owns URLs; it should not become the main place for business logic.
- `components` render UI; if a component starts owning data fetching rules, extract a hook or service.
- `services` know API endpoints; components should not repeat endpoint strings when a service already exists.
- `utils` should be deterministic helpers. If it needs `fetch`, `session`, `notification`, or browser globals, it probably belongs elsewhere.
- `context` and `providers` are intentionally separate: context defines app state contracts, providers wire third-party libraries or root wrappers.

L
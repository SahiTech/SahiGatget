# Phase G Architecture Map

## Authoritative execution path

The public storefront renders `components/assistant/assistant-button.tsx` from `app/(storefront)/layout.tsx`. The button opens the existing accessible modal in `components/assistant/assistant-panel.tsx`, which sends the same public request envelope to `app/api/assistant/route.ts`.

The route preserves authentication-independent public access, request validation, distributed rate limiting, and the existing service entry point. The service wrapper delegates to `lib/assistant/service-v3.ts`, which loads the existing `assistant_config` settings, applies server-side capability and knowledge-source gates, resolves the existing encrypted provider through `lib/assistant/config.ts`, retrieves public product and policy context through `lib/assistant/retrieval.ts`, validates model output, and falls back deterministically when the provider is unavailable or unsafe.

## Admin control path

`app/admin/(operations)/ai-assistant/page.tsx` loads `lib/admin/assistant-data.ts`, which requires the existing OWNER/ADMIN roles and reads assistant settings plus aggregate assistant audit events. `components/admin/assistant-control-center.tsx` edits the existing `assistant_config` and `assistant_policy` settings through `lib/admin/assistant-actions.ts`. All writes continue through `requireAdmin`, schema validation, the existing service-role admin client, revalidation, and `writeAdminAuditLog`.

## Configuration boundaries

Phase G profile, preset, personality, response style, capability, knowledge-source, support-channel, business-profile, behavior, and model-preset data are nested in the existing `assistant_config` settings record. No second assistant configuration table was introduced. Provider API keys remain exclusively in the existing singleton `assistant_provider_configurations` table, encrypted through the authoritative AES-256-GCM path and never included in the Phase G settings payload, audit metadata, prompts, or client props.

## Data adapter boundary

SahiGadget continues to use the existing storefront retrieval functions as its public data adapter: products and variants come from `lib/services/storefront.ts` and `lib/services/storefront-utils.ts`; policy and business context are assembled by `lib/assistant/retrieval.ts`. Phase G configuration controls which public sources are eligible, but it does not add a private-data cache, arbitrary SQL surface, tenant system, vector store, or channel-specific business logic.

## Response priority

The runtime order remains security and privacy boundaries first, capability and knowledge-source permissions second, grounded public retrieval third, conversational context and configured behavior next, and provider-generated language last. The provider receives only the approved public context, recent safe conversation turns, and non-secret configuration metadata.

## Production isolation

Phase G is intended for an isolated branch and Preview deployment only. Merging to `main`, changing Production configuration, entering credentials, and triggering Production promotion require a separate explicit owner approval after the Phase G gates pass.

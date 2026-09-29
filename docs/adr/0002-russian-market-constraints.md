# 0002. Architecture for Russian market constraints

Date: 2026-09-29 · Status: Accepted

## Context
Sipclock targets Russia and international markets. Three rules affect architecture, not only legal copy:
1. **LLM availability.** Anthropic's API is not available in Russia.
2. **152-FZ data localization.** Since 1 July 2025 the primary collection of Russian citizens' personal data must
   happen in databases located in Russia.
3. **Alcohol advertising.** Alcohol advertising on the internet is prohibited (38-FZ, art. 21). Recipes are fine;
   brand promotion is not.
Store billing is also unavailable to Russian users (App Store since April 2026, Google Play since 2022).

## Decision
- **LLM gateway** behind a provider interface: Claude for international users, a Russian provider
  (YandexGPT or GigaChat) for Russian users, routed by account region. One eval suite runs against both.
- **Regional data:** a Russian deployment (Postgres + auth) serves users registered in Russia. Error tracking,
  analytics and telemetry either run self-hosted in that region or receive data scrubbed of personal fields.
- **Generic ingredients:** the catalog stores ingredient categories ("white rum"); brands live in a separate table and
  are shown by region policy. Bottle recognition returns a category in Russia. An 18+ age gate precedes content.
- **Billing:** RevenueCat (App Store, Google Play, Stripe web) plus RuStore Pay SDK, reconciled in our own entitlements
  service.

## Consequences
- More moving parts (two LLM providers, two regions, two billing paths); each hides behind an interface so the MVP
  can ship with one implementation per concern.
- Legal review is still required before launch in Russia; this record covers architecture only.

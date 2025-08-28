# AI Game Narrative Generator — TODO (V1, Phased)

> Owner tags: **[FE]**, **[BE]**, **[MLE]**, **[SRE]**, **[QA]**, **[PM]**  
> Max **5** phases; grouped for larger execution blocks; no tasks dropped.

---

## Phase 1: Foundations, Infra & Schema
- [x] [PM][SRE] Monorepo setup (`/frontend`, `/api`, `/workers`, `/infra`, `/docs`); conventions and CODEOWNERS.
- [x] [SRE] CI/CD (lint/typecheck/unit/integration, Docker build, scan/sign, deploy dev/staging).
- [x] [SRE] Infra: Postgres 16 + pgvector, Redis, NATS, S3/R2, optional Neo4j; secrets via KMS.
- [x] [BE] Base API (NestJS): OpenAPI 3.1, Zod validation, Problem+JSON, RBAC (Casbin), RLS; Request‑ID + Idempotency‑Key.
- [x] [BE] Schema migrations: projects, story_arcs, quests, dialogues, lore_entries, characters, simulations, exports, audit_log.
- [x] [BE] Signed upload endpoints; seed demo data; content policy configuration (themes/tone/age rating).

---

## Phase 2: CrewAI Agents, Bus & Core Pipelines
- [x] [BE][MLE] Worker scaffolds (FastAPI): **story-architect**, **quest-designer**, **dialogue-writer**, **lore-keeper**, **simulator**, **exporter**.
- [x] [SRE] NATS subjects: `story.new`, `quest.make`, `dialogue.make`, `lore.check`, `simulate.run`, `export.make`; Redis Streams DLQ; retries/backoff with jitter.
- [x] [BE] Agent orchestration contracts (schemas for inputs/outputs); store **reasoning traces** for review.
- [x] [MLE] Embedding utilities for semantic consistency checks (pgvector).
- [x] [BE] API surfaces:
  - [x] `POST /story/arcs` (create/generate), `POST /quests`, `POST /dialogues`, `POST /lore`.
  - [x] `POST /simulate`, `POST /exports/storygraph`.
  - [x] `GET /lore/search?query=` (vector similarity).
- [ ] [QA] Pipeline integration tests: story → quest → dialogue → lore → simulate → export.

---

## Phase 3: Story/Quest Authoring & Graph
- [x] [FE] StoryMap (Cytoscape.js): arcs/quests/outcomes; create/edit; validation badges for broken chains.
- [x] [FE] QuestEditor: conditions (stats/inventory/flags), rewards, branching outcomes with templates (escort/fetch/puzzle/boss/diplomacy/betrayal).
- [x] [BE] Graph validation service: topological checks; reachability; orphan detection; export‑readiness status.
- [x] [MLE] Quest generation patterns mapped to narrative beats (rising/climax/resolution).
- [x] [QA] Authoring E2E: create arc → add quests → validate → export JSON (dry run).

---

## Phase 4: Dialogue, Characters, Lore & Simulation
- [x] [FE] DialogueTree editor: branching nodes, conditions, emotion/tone tags; keyboard navigation; preview panel.
- [x] [FE] LoreBrowser: encyclopedia with categories; inline canon warnings; search & link to quests/dialogues.
- [x] [FE] SimulationViewer: run playthroughs; show reputation/alignment changes; timeline log.
- [x] [MLE] Dialogue writer with **NPC memory** (quest state & past choices); tone control; age‑rating filter.
- [x] [MLE] Lore Keeper gating (embedding + rules) before commits/exports; faction dynamics model.
- [x] [BE] Reputation/alignment subsystem; persistence to `simulations` table.
- [x] [QA] Scenario tests covering contradictions, age‑rating violations, and NPC memory regressions.

---

## Phase 5: Exports, Observability, Security & QA
### Exports
- [x] [BE] Exporter worker: JSON/YAML story graphs, dialogue trees, quest schemas; PDF/HTML design docs.
- [x] [FE] ExportWizard: packaging & download; warnings for lore/graph issues; read‑only previews.
### Observability & SRE
- [x] [SRE] OTel spans: `story.generate`, `quest.design`, `dialogue.make`, `lore.check`, `simulate.run`, `export.render`.
- [x] [SRE] Prometheus/Grafana dashboards; Sentry for invalid lore refs/broken chains.
- [x] [SRE] Load & chaos tests: thousands of nodes; worker restarts; DLQ drain runbooks.
### Security & Governance
- [x] [BE] RLS enforcement tests; RBAC guards; audit logging for AI vs human edits.
- [x] [BE] Signed URLs; per‑project encryption keys; data export/delete APIs.
- [x] [PM] Content policy configs + review queue; disclaimer that tool augments, not replaces, writers.
### Testing
- [x] [QA] Integration: arc → quest → dialogue → lore → simulate → export.
- [x] [QA] E2E (Playwright): create project → generate content → simulate → export.
- [x] [QA] Performance: export p95 < 5s story graph, < 4s 10‑node dialogue tree.
- [x] [QA] Accessibility: keyboard flows in editors; SR labels on graph nodes.

---

## Definition of Done
- [ ] Delivered with API spec + tests, FE states (loading/empty/error), SLOs met in staging, accessibility pass, content policy filters enforced, reproducible exports.
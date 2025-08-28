# AI Game Narrative Generator — Architecture (V1)

## 1) System Overview
**Frontend/BFF:** Next.js 14 (Vercel) — SSR for story maps; ISR for previews; Server Actions for exports.  
**API Gateway:** NestJS (Node 20) — REST **/v1** with OpenAPI 3.1, Zod validation, Problem+JSON, RBAC (Casbin), RLS, Idempotency‑Key + Request‑ID.  
**CrewAI Workers (Python 3.11 + FastAPI):**
- **story-architect** — branching arcs & pacing
- **quest-designer** — quest structures, conditions, rewards
- **dialogue-writer** — NPC dialogue trees with emotion/tone
- **lore-keeper** — canon enforcement, consistency checks
- **simulator** — player choice propagation; reputation/alignment
- **exporter** — JSON/YAML/PDF/HTML packaging

**Event Bus/Queues:** NATS (`story.new`, `quest.make`, `dialogue.make`, `lore.check`, `simulate.run`, `export.make`) + Redis Streams DLQ.  
**Datastores:** Postgres 16 + **pgvector** (semantic lore/consistency checks), S3/R2 (exports), Redis (cache/session), optional **Neo4j** (narrative graph).  
**Observability:** OpenTelemetry + Prometheus/Grafana; Sentry for errors.  
**Security:** TLS/HSTS/CSP; Cloud KMS; per‑project encryption; Postgres **RLS**; audit logs.

## 2) Data Model (summary)
- **Projects**: projects (org‑scoped).  
- **Story**: story_arcs (title/description/meta).  
- **Quests**: quests (conditions, rewards, outcomes).  
- **Dialogues**: dialogues (character, node graph, conditions, next_nodes, emotion).  
- **Lore**: lore_entries (category/name/description + embedding).  
- **Characters**: characters (role, faction, traits, backstory).  
- **Simulations**: simulations (player profile, results).  
- **Exports**: exports (kind, s3_key, meta).  
- **Audit**: audit_log (AI vs human edits tracked).

**Invariants**
- RLS by project_id; all mutations audited.  
- Story arcs → ≥1 quest; each quest → ≥1 dialogue node.  
- Lore checks must pass prior to export (lore‑keeper gating).  
- Agent **reasoning traces** stored and viewable for transparency.

## 3) Key Flows

### 3.1 Story & Quest Generation
1. `POST /story/arcs` emits `story.new` → **story-architect** drafts arcs & beats.  
2. **quest-designer** expands beats into quests (conditions/rewards/outcomes).  
3. Graph validation service checks for broken chains and reachability; status surfaced in UI.

### 3.2 Dialogue & Characters
1. `POST /dialogues` → **dialogue-writer** creates branching dialogue given quest state, character profile, and player flags.  
2. Nodes include `conditions`, `next_nodes`, `emotion` tags, tone controlled by config; NPC memory references prior interactions.

### 3.3 Lore & Consistency
1. `POST /lore` creates/updates entries; embeddings updated.  
2. **lore-keeper** validates new/edited content versus canon; blocks inconsistent exports; issues warnings in UI.  
3. Faction dynamics influence quest availability and dialogue choices.

### 3.4 Simulation
1. `POST /simulate` with player profile triggers **simulator** to propagate choices; updates reputation/alignment and generates quest log timeline.  
2. Results stored in `simulations` and visualized in SimulationViewer.

### 3.5 Exports
1. `POST /exports/storygraph` triggers **exporter** to bundle arcs/quests/dialogues/lore → JSON/YAML/PDF/HTML, stored to S3 with signed URL.  
2. Export validation includes lore consistency and graph integrity checks.

## 4) API Surface (REST /v1)
- **Projects:** `POST /projects`, `GET /projects/:id`  
- **Story & Quests:** `POST /story/arcs`, `POST /quests`, `GET /quests/:id/dialogues`  
- **Dialogue & Lore:** `POST /dialogues`, `POST /lore`, `GET /lore/search?query=`  
- **Simulation:** `POST /simulate`  
- **Exports:** `POST /exports/storygraph`  

**Conventions:** Idempotency‑Key; Problem+JSON errors; cursor pagination; SSE for streaming dialogue generation.

## 5) Observability & SLOs
- **Spans:** story.generate, quest.design, dialogue.make, lore.check, simulate.run, export.render.  
- **Metrics:** branching factor, dialogue node count, simulation latency, export p95.  
- **SLOs:** arc gen <6s p95; dialogue (10 nodes) <4s p95; simulation <2s p95; export graph <5s p95; pipeline success ≥99%.

## 6) Security & Governance
- RLS isolation; Casbin RBAC at API.  
- Per‑project encryption; signed URLs; audit trails for AI vs human edits.  
- Content filters (age rating, themes/tone) executed pre‑commit and pre‑export.  
- Export/delete APIs; read‑only previews for playtesters.

## 7) Performance & Scaling
- pgvector HNSW for lore similarity; cache hot branches in Redis.  
- Optional Neo4j for large narrative graphs and subgraph queries.  
- Horizontal scale for workers; DLQ with exponential backoff/jitter.  
- Precompute popular questlines for demos.

## 8) Accessibility & i18n
- Screen‑reader labels for graph nodes and dialogue chips.  
- Keyboard navigation in editors; high‑contrast mode.  
- next‑intl for multi‑language dialogue previews.
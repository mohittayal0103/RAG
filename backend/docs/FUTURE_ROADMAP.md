# Future Roadmap — RAG Document Assistant

> **Purpose:** Documents planned future work. Nothing here is implemented yet.
>
> **Rule:** Do not implement anything from this file without an explicit task or ticket. This is a planning document, not a backlog.

---

## Current State (Milestone 1 — Complete)

The backend is feature-complete for Milestone 1:

- [x] Document upload, ingestion, reindex, delete
- [x] Semantic retrieval with similarity threshold
- [x] Grounded answer generation via Gemini 2.5 Flash
- [x] Conversation memory (SQLite sessions + messages)
- [x] Multi-turn context in prompts (last 20 turns)
- [x] Rate limiting on all mutating endpoints
- [x] Liveness + readiness health checks
- [x] Graceful shutdown
- [x] Atomic metadata writes
- [x] Request IDs on all requests and responses
- [x] documentId-based vector lifecycle (not fileName)
- [x] Prompt injection defence for conversation history

---

## Phase 2 — Frontend (Next)

**Goal:** A usable browser interface so users do not need `curl` to interact with the system.

**Estimated complexity:** Medium. The API is already frontend-ready — every endpoint returns JSON that maps directly to UI components.

---

### 2.1 React Frontend Application

**Technology:** React (Vite or Create React App), served separately from the API (different port in development, same origin in production via nginx or a static server).

**Why React:** The project's existing skillset. The component model maps naturally to the sidebar (session list) + main area (chat) + panel (document library) layout.

**Alternative:** Next.js — adds server-side rendering and file-based routing. Worth considering if SEO or initial load time matters.

---

### 2.2 Session Sidebar

**Endpoint used:** `GET /sessions`

**Behaviour:**
- List all sessions sorted by most-recently-updated first.
- Show session title (derived from first question) or a placeholder for untitled sessions.
- Clicking a session loads its message history.
- A "New session" button calls `POST /sessions` and opens an empty chat.

**Implementation notes:**
- Poll `GET /sessions` on a short interval (e.g. every 30s) or use WebSocket to push new sessions.
- Sessions have no delete endpoint yet — this would need to be added (Phase 2 backend addition).

---

### 2.3 Chat Interface

**Endpoints used:** `POST /chat`, `GET /sessions/:sessionId/messages`

**Behaviour:**
- On session load: fetch full message history and render it as a conversation thread.
- User types a question → submit → POST /chat → append answer below.
- Show a loading spinner while waiting for the answer (Gemini calls take 1–5s).
- Display the `sources` array (source filename + chunk index) below each answer as expandable citations.
- Show an error message if the answer is "I could not find that information in the documents."

**Implementation notes:**
- The answer is returned in one shot (not streamed). For streaming, see Phase 3.2.
- The `chunksUsed` field in the response can be shown as "answered using N passages."

---

### 2.4 Document Upload Panel

**Endpoints used:** `POST /documents/upload`, `GET /documents`, `DELETE /documents/:fileName`, `GET /documents/:fileName/chunks`

**Behaviour:**
- A file picker or drag-and-drop zone accepting `.pdf`, `.txt`, `.md`.
- Show an upload progress indicator (the API does not return progress, so show a spinner with "This may take a minute on the free tier").
- After upload: add the document to the list without a full page reload.
- Each document shows: fileName, uploadedAt, chunk count.
- A delete button per document calls `DELETE /documents/:fileName`.
- A reindex button calls `POST /documents/:fileName/reindex`.

**Implementation notes:**
- The upload endpoint takes 10–120 seconds on the Gemini free tier (12s per chunk). The frontend must not time out before the server responds. The server's ingestion timeout is 10 minutes.

---

### 2.5 Backend Additions Required for Phase 2

These small backend additions are needed to fully support the frontend:

| Endpoint | Purpose |
|----------|---------|
| `DELETE /sessions/:sessionId` | Allow users to delete a session from the sidebar |
| `GET /sessions/:sessionId` | Return single session metadata (for breadcrumb or title display) |

These are straightforward additions following the same pattern as existing session endpoints.

---

## Phase 3 — Retrieval Quality & UX

**Goal:** Faster perceived response times and better answers for complex or ambiguous questions.

---

### 3.1 Streaming Responses

**Problem:** Users currently wait 2–5 seconds for the full answer before seeing any text. This makes the interface feel slow compared to chat products like ChatGPT.

**Solution:** Use Gemini's streaming API and Server-Sent Events (SSE) on a new endpoint `POST /chat/stream`. The server emits tokens as they are generated:

```
POST /chat/stream → text/event-stream
data: {"token": "useState"}
data: {"token": " is"}
data: {"token": " a"}
...
data: {"done": true, "sources": [...], "chunksUsed": 2}
```

**Implementation notes:**
- Add `res.setHeader('Content-Type', 'text/event-stream')`.
- Use `ai.models.generateContentStream()` from `@google/genai`.
- The conversation history read and `saveExchange()` write work identically — only the Gemini call and response format change.
- The `saveExchange()` call must be deferred until streaming is complete (the full answer text is needed to write to the database).

---

### 3.2 Hybrid Search (BM25 + Vector)

**Problem:** Pure semantic search misses exact-match questions. A question like "what does `PRAGMA foreign_keys` do?" benefits from lexical search finding the exact string `PRAGMA foreign_keys`, but semantic search might return a less relevant passage about database configuration.

**Solution:** Combine vector similarity (semantic) with BM25 keyword search (lexical) using Reciprocal Rank Fusion (RRF) to merge rankings:

```
Question
  ├─ Vector search (ChromaDB) → ranked list A
  └─ BM25 search (in-memory or SQLite FTS5) → ranked list B
      ↓
  RRF merge → final ranked list
      ↓
  Similarity threshold filter
      ↓
  Prompt builder
```

**Implementation notes:**
- SQLite has a built-in full-text search extension (FTS5). Chunk text could be stored there alongside ChromaDB.
- `fts5` is available in `better-sqlite3` without additional dependencies.
- The `src/database/initDatabase.js` would need a new `chunks_fts` virtual table.

---

### 3.3 Reranking

**Problem:** Bi-encoder cosine similarity (the current approach) is fast but imprecise. Two chunks can have high cosine similarity without the chunk actually answering the question.

**Solution:** After ChromaDB retrieval returns top-K candidates (e.g. top-10), a cross-encoder reranker re-scores each candidate by jointly encoding the question + chunk. Cross-encoders are significantly more accurate but too slow to run over the entire vector database — the two-stage pattern extracts the best of both:

```
Stage 1: ChromaDB ANN → top-10 candidates (fast, approximate)
Stage 2: Cross-encoder reranker → top-3 after re-scoring (slow, precise)
```

**Implementation notes:**
- A lightweight cross-encoder (e.g. `ms-marco-MiniLM-L-6-v2`) can run locally via a Python service.
- Alternatively, use a hosted reranking API (Cohere Rerank, Jina Rerank).
- This requires a local Python microservice or an additional cloud API — adds infrastructure complexity.

---

### 3.4 Larger Context Window (Top-K Tuning)

**Problem:** The current `topK = 3` retrieves a maximum of 3 chunks before filtering. For complex questions that span multiple sections of a document, 3 chunks may not provide enough context.

**Solution:** Increase `topK` to 5 or 10 in `src/config/retrievalConfig.js`. The similarity threshold still acts as the quality gate — more candidates are retrieved but only qualifying ones reach the prompt.

**Trade-off:** More tokens in the prompt → slightly higher Gemini cost per request. For the free tier this is negligible. For paid tier, measure the quality improvement vs cost increase.

---

## Phase 4 — Multi-User & Production Infrastructure

**Goal:** Support multiple users with isolated document libraries and conversation histories.

---

### 4.1 Authentication

**Problem:** The current API has no authentication. Any client can read any session, upload any document, and delete any document.

**Solution:** Add a middleware layer that validates a JWT or API key on every request:

```js
// In app.js, before route registration
app.use('/chat',      authMiddleware, chatRoutes);
app.use('/documents', authMiddleware, documentRoutes);
app.use('/sessions',  authMiddleware, sessionRoutes);
```

`authMiddleware` sets `req.userId` from the validated token. All downstream handlers receive the user's identity.

**Implementation options:**
- Self-issued JWTs (no auth service dependency) — simplest
- Auth0, Clerk, Supabase Auth — managed identity providers
- API keys (static, per-user) — simplest for machine-to-machine use

---

### 4.2 User Accounts

**Schema changes:**

```sql
ALTER TABLE sessions ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous';
CREATE INDEX idx_sessions_user_id ON sessions(user_id, updated_at DESC);
```

`GET /sessions` changes to `WHERE user_id = req.userId`. Each user sees only their own sessions.

---

### 4.3 Per-User Document Libraries

**Current state:** All users share a single ChromaDB collection (`rag-documents`). Any user can retrieve chunks from any document.

**Solution:**
- Option A: Namespace chunks by `userId` in ChromaDB metadata. Filter queries by `{ userId: req.userId }`.
- Option B: One ChromaDB collection per user. Simpler isolation but harder to manage.
- Option C: A `document_permissions` table linking `documentId` to `userId`. Retrieval queries first look up which `documentIds` the user can access, then filter ChromaDB results accordingly.

**Recommended:** Option A (metadata filtering) — compatible with the existing single-collection architecture, requires only a `userId` field in chunk metadata and a `where` clause addition to the retrieval query.

---

### 4.4 PostgreSQL Migration

**When:** When the deployment moves from single-node to a cluster (multiple API instances behind a load balancer).

**Why:** SQLite serialises writes to a single file. Multiple Node processes on different machines cannot safely share a single SQLite file. PostgreSQL handles concurrent writes from multiple clients natively.

**Migration effort:** Low. The session and message queries are simple, standard SQL. `better-sqlite3` is replaced by `pg` (node-postgres) or `@prisma/client`. The same queries run unchanged except for the driver syntax.

**Schema is identical.** No data transformations are needed.

---

### 4.5 Cloud Document Storage

**When:** When the deployment moves to cloud infrastructure or multiple nodes need to share uploaded files.

**Current:** Files are stored in `src/uploads/` on the local filesystem. In a multi-node deployment, each node has its own filesystem — a file uploaded to node A is not accessible from node B.

**Solution:** Replace `fs.writeFileSync` (in multer storage) with an S3 `putObject` call. Replace `fs.readFileSync` (in `extractText()`) with an S3 `getObject` call. The rest of the pipeline is unchanged.

**Options:** AWS S3, Google Cloud Storage, Cloudflare R2 (S3-compatible, cheaper egress), MinIO (self-hosted S3-compatible).

---

## Phase 5 — Advanced Intelligence

**Goal:** More capable, autonomous, and context-aware responses.

---

### 5.1 Advanced Memory Compression

**Problem:** The current system includes the last 20 messages verbatim in every prompt. For very long conversations (100+ turns), 20 messages may not cover important context from much earlier in the conversation. But including all 100+ turns would exceed the context window and significantly increase token costs.

**Solution:** A summarisation step that compresses older conversation history:

```
Recent turns (last 5):  included verbatim
Older turns (6-50):     summarised by Gemini into a ~200-word summary
Very old turns (50+):   stored in SQLite but not included in prompts
```

The summary is regenerated periodically (e.g. every 10 turns) and stored in the `sessions` table as a `summary` column.

---

### 5.2 Agent Workflows

**Problem:** The current system is single-pass: one retrieval call, one generation call. Complex questions requiring multi-step reasoning ("Compare the useState and useReducer hooks. Which should I use for form state?") may not be fully answered from a single top-3 retrieval.

**Solution:** An agentic loop that lets the LLM decide whether to retrieve more information:

```
Question → Initial retrieval → LLM generates partial answer
  → LLM: "I need more context about useReducer"
    → Second retrieval for "useReducer"
      → LLM synthesises final answer from both retrievals
```

**Implementation options:**
- LangGraph — state machine-based agent framework for Node.js/Python
- Custom loop — a simple `while (needsMoreContext)` loop that re-queries ChromaDB

**Trade-off:** Each additional retrieval adds a Gemini embedding call and a ChromaDB query. Agent loops can be slow and expensive if not capped.

---

### 5.3 Knowledge Graph

**Problem:** Vector similarity captures semantic relatedness but not explicit relationships. "What are all the hooks that useState is related to?" requires understanding connections between concepts, not just similarity.

**Solution:** At ingest time, extract entities and relationships from document chunks using an LLM ("useState relates_to useEffect, depends_on React"). Store these in a graph database (Neo4j) or a SQLite edge table. At query time, combine graph traversal results with vector retrieval.

**Implementation complexity:** High. Requires LLM-based entity extraction at ingest time, a graph storage layer, and a query strategy that combines graph results with vector results. Best deferred until Phase 3/4 is complete.

---

### 5.4 Multi-Modal Documents

**Problem:** Many real-world documents contain tables, charts, diagrams, and images that carry information not captured by text extraction. A PDF with a chart showing performance benchmarks would have the chart's data lost entirely under the current text-only extraction.

**Solution:** Use a multi-modal model (Gemini Vision, GPT-4V) at ingest time to describe images and extract data from tables. The descriptions become additional text chunks stored alongside normal text chunks.

**Implementation notes:**
- `pdf-parse` does not extract images. A different library (e.g. `pdf2pic` + vision API) would be needed.
- Each image description call adds Gemini API cost and latency.
- Table extraction (via `pdfplumber` in Python or a similar Node library) could be added as a pre-processing step.

---

## Implementation Priority Guide

When deciding what to implement next, use this priority order:

1. **Phase 2 (Frontend)** — Immediate value. The API is already complete and tested. A frontend makes the project usable by non-technical users and demonstrates the full end-to-end experience.

2. **Phase 3.1 (Streaming)** — High UX impact, low complexity. Gemini's streaming API is well-documented. SSE is a simple HTTP feature. This can be added to the existing `POST /chat` endpoint with minimal risk.

3. **Phase 4.1 (Authentication)** — Required before sharing the API with others. Without it, any user can see all conversations and documents.

4. **Phase 3.2 (Hybrid search)** — Measurable retrieval quality improvement. SQLite FTS5 is built-in — no new infrastructure required.

5. **Phase 4.2/4.3 (Multi-user)** — Follows naturally from authentication. Schema changes are simple.

6. **Phase 3.3 (Reranking)** — High quality improvement but adds infrastructure (Python service or paid API). Defer until retrieval quality is a measured bottleneck.

7. **Phase 4.4/4.5 (PostgreSQL / Cloud storage)** — Only needed when moving to multi-node deployment. Not required for a single-server production deployment.

8. **Phase 5 (Advanced intelligence)** — Long-term. Implement only after Phase 2-4 are complete and user feedback identifies specific gaps that these features would address.

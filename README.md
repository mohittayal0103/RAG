# RAG Document Assistant

A full-stack **Retrieval-Augmented Generation (RAG)** application. Upload documents, ask natural-language questions, get grounded answers with source citations — across multi-turn conversations.

---

## Table of Contents

1. [What It Does](#1-what-it-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Quick Start](#5-quick-start)
6. [Environment Variables](#6-environment-variables)
7. [API Reference](#7-api-reference)
8. [How the Pipelines Work](#8-how-the-pipelines-work)
9. [Configuration](#9-configuration)
10. [Debugging Guide](#10-debugging-guide)
11. [Known Bugs Fixed](#11-known-bugs-fixed)
12. [Roadmap](#12-roadmap)

---

## 1. What It Does

Users upload PDF or text documents, then ask questions in a chat interface. The system:

1. Splits each document into overlapping chunks and embeds them via Gemini
2. At query time, embeds the question and finds the most semantically similar chunks
3. Sends only the relevant chunks to Gemini 2.5 Flash to generate a grounded answer
4. Stores the full conversation in SQLite so follow-up questions have context

```
User:   "What is useState?"
System: "useState is a React Hook that lets you add state to a functional
         component. It returns [currentValue, setter]."

User:   "What does it return?"          ← references previous turn
System: "It returns an array: [currentStateValue, setterFunction]..."
```

The system only answers from uploaded documents. Off-topic questions receive "I could not find that information in the documents."

---

## 2. Architecture Overview

```
┌──────────────────────────────────────┐
│        React Frontend (:5173)         │
│  Session sidebar | Chat | Doc upload  │
└───────────────────┬──────────────────┘
                    │ HTTP (proxied /api → :5000)
                    ▼
┌──────────────────────────────────────┐
│       Express API (:5000)            │
│  /chat  /documents  /sessions        │
└──────┬───────────────┬───────────────┘
       │               │
       ▼               ▼
┌────────────┐   ┌────────────┐   ┌──────────────┐
│  ChromaDB  │   │ Gemini API │   │   SQLite     │
│  (:8000)   │   │ embeddings │   │  rag.db      │
│  vectors   │   │ + answers  │   │  sessions +  │
└────────────┘   └────────────┘   │  messages    │
                                   └──────────────┘
```

**Three external dependencies:**
- **ChromaDB** — local vector database (port 8000), stores document embeddings
- **Gemini API** — `gemini-embedding-001` for vectors, `gemini-2.5-flash` for answers
- **SQLite** — embedded database (`backend/src/database/rag.db`), stores sessions and messages

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, MUI (Material UI), Axios, React Router |
| Backend | Node.js, Express 5, better-sqlite3, multer |
| Vector store | ChromaDB (local HTTP server) |
| AI | Google Gemini (`@google/genai`) |
| PDF parsing | pdf-parse v2 |
| Dev tooling | nodemon, ESLint |

---

## 4. Project Structure

```
Project1/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── app.js                  ← Express app (middleware + routes)
│   │   │   ├── server.js               ← Entry point (bootstrap + listen)
│   │   │   ├── controllers/            ← HTTP handlers (chat, document, session, health)
│   │   │   └── routes/                 ← Route registration + rate limiters
│   │   ├── chunkers/
│   │   │   └── textChunker.js          ← Parent-child semantic chunker
│   │   ├── config/                     ← All tunable constants (single source of truth)
│   │   │   ├── apiConfig.js            ← Port, timeouts
│   │   │   ├── chromaConfig.js         ← ChromaDB host/port/collection
│   │   │   ├── chunkerConfig.js        ← parentMaxChars, childMaxChars, overlap
│   │   │   ├── embeddingConfig.js      ← Model, retry config
│   │   │   ├── retrievalConfig.js      ← topK, minimumSimilarity
│   │   │   └── uploadConfig.js         ← uploadDir, maxSize, allowedExtensions
│   │   ├── database/
│   │   │   ├── sqlite.js               ← Singleton DB connection (WAL + FK)
│   │   │   ├── initDatabase.js         ← Schema + indexes (idempotent)
│   │   │   └── rag.db                  ← SQLite file (created at runtime)
│   │   ├── embeddings/
│   │   │   └── embeddingService.js     ← Gemini embedding API + retry logic
│   │   ├── rag/
│   │   │   └── answerGenerator.js      ← Prompt builder + Gemini generation
│   │   ├── retrieval/
│   │   │   └── retriever.js            ← Embed question → ChromaDB → filter
│   │   ├── services/
│   │   │   ├── documentIngestionService.js  ← Full ingest/reindex/delete pipeline
│   │   │   └── sessionService.js            ← SQLite CRUD for sessions + messages
│   │   ├── vectorstore/
│   │   │   └── chromaService.js        ← ChromaDB client singleton + upsert/query
│   │   ├── utils/
│   │   │   ├── bootstrap.js            ← Create runtime dirs + seed files
│   │   │   └── logger.js               ← Timestamped console logger
│   │   ├── uploads/                    ← Uploaded files (created at runtime)
│   │   └── data/
│   │       └── documents.json          ← Document metadata registry
│   ├── docs/
│   │   ├── DEVELOPER_ONBOARDING.md
│   │   ├── PROJECT_ARCHITECTURE.md
│   │   └── FUTURE_ROADMAP.md
│   ├── .env                            ← GEMINI_API_KEY (never commit)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/                        ← Axios API client modules
│   │   ├── components/                 ← Reusable UI components
│   │   ├── pages/                      ← Route-level page components
│   │   ├── hooks/                      ← Custom React hooks
│   │   ├── services/                   ← Business logic / state helpers
│   │   ├── theme/                      ← MUI dark glassmorphism theme
│   │   └── App.jsx
│   └── vite.config.js                  ← Dev server :5173, proxy /api → :5000
│
└── README.md                           ← This file
```

---

## 5. Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+ and pip
- A [Gemini API key](https://aistudio.google.com/apikey)

### 1. Install ChromaDB

```bash
pip3 install chromadb
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env       # or create .env manually
# Add your key: GEMINI_API_KEY=your_key_here
```

### 3. Set up the frontend

```bash
cd frontend
npm install
```

### 4. Run (three terminals)

**Terminal 1 — ChromaDB:**
```bash
cd backend
npm run chroma
# Wait for: Server running on http://0.0.0.0:8000
```

**Terminal 2 — Backend API:**
```bash
cd backend
npm run dev:api
# Starts on http://localhost:5000
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
# Opens on http://localhost:5173
```

### 5. Verify

```bash
curl http://localhost:5000/health/ready
# → {"status":"ready"}
```

If you get `"ChromaDB is unreachable"` — make sure Terminal 1 is running.

---

## 6. Environment Variables

Create `backend/.env`:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional overrides (defaults shown)
PORT=5000
REQUEST_TIMEOUT=30000         # ms — standard routes
INGESTION_TIMEOUT=600000      # ms — upload/reindex routes (10 min)
LOG_LEVEL=info
```

`.env` is gitignored and must never be committed.

---

## 7. API Reference

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness — is the process alive? |
| `GET` | `/health/ready` | Readiness — are all dependencies reachable? |

`/health/ready` checks: `GEMINI_API_KEY` present → ChromaDB heartbeat → ChromaDB collection → uploads dir → documents.json. Returns `503` with the specific failure reason on the first check that fails.

---

### Chat

#### `POST /chat`

Ask a question in a session.

**Rate limit:** 20 requests/min per IP

**Request:**
```json
{
  "sessionId": "uuid",
  "question": "What is useState in React?"
}
```

**Response `200`:**
```json
{
  "success": true,
  "answer": "useState is a React Hook that...",
  "sources": [{ "source": "reactguide.pdf", "chunkIndex": 4 }],
  "chunksUsed": 3
}
```

**Errors:** `400` invalid input · `404` session not found · `429` rate limited

---

### Documents

#### `POST /documents/upload`

Upload a file and run the full ingestion pipeline.

**Rate limit:** 5 requests/min per IP  
**Body:** `multipart/form-data`, field name `file`  
**Accepted:** `.pdf`, `.txt` · Max 10 MB

**Response `201`:**
```json
{
  "success": true,
  "documentId": "uuid",
  "fileName": "reactguide.pdf",
  "chunksCreated": 12,
  "vectorsStored": 12
}
```

**Errors:** `400` bad extension/size · `409` duplicate or upload in progress · `413` file too large

---

#### `GET /documents`

List all indexed documents.

```json
[
  {
    "documentId": "uuid",
    "fileName": "reactguide.pdf",
    "uploadedAt": "2024-01-15T10:00:00.000Z",
    "chunks": 12
  }
]
```

---

#### `GET /documents/stats`

```json
{ "collectionName": "rag-documents", "totalRecords": 47 }
```

---

#### `GET /documents/:fileName`

Single document metadata. `404` if not found.

---

#### `GET /documents/:fileName/chunks`

Per-chunk debug view — reads directly from ChromaDB.

```json
{
  "fileName": "reactguide.pdf",
  "totalChunks": 12,
  "chunks": [{ "chunkIndex": 0, "length": 987 }, ...]
}
```

---

#### `POST /documents/:fileName/reindex`

**Rate limit:** 5 requests/min per IP

Re-embeds the document using current chunking and model settings. The original file is read from `uploads/`. Orphaned old vectors are cleaned up. Preserves the existing `documentId`.

---

#### `DELETE /documents/:fileName`

Removes all vectors from ChromaDB, the metadata entry, and the file from disk.

```json
{ "success": true, "deletedChunks": 12 }
```

---

### Sessions

#### `POST /sessions`

**Rate limit:** 10 requests/min per IP

Creates a new conversation session. Call this first, then use the returned `sessionId` in `POST /chat`.

```json
{ "sessionId": "uuid" }
```

---

#### `GET /sessions`

List all sessions, most-recently-active first.

```json
[
  {
    "id": "uuid",
    "title": "What is useState in React?",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:05:00.000Z"
  }
]
```

`title` is `null` for sessions that have never had a message sent.

---

#### `GET /sessions/:sessionId/messages`

Returns up to 20 messages in chronological order. `404` if session not found.

```json
[
  { "role": "user",      "content": "What is useState?" },
  { "role": "assistant", "content": "useState is a React Hook..." }
]
```

---

## 8. How the Pipelines Work

### Document Ingestion Pipeline

```
Upload (multipart/form-data)
  → multer: validate extension + size, write to src/uploads/
  → concurrent upload guard (prevents race condition on same fileName)
  → duplicate check (documents.json)
  → extractText(): magic-byte PDF detection → pdf-parse or UTF-8 read
  → assign permanent documentId (UUID v4, never changes)
  → chunkDocument(): parent-child semantic chunking
       Parent chunks: split on headings/paragraphs (≤2000 chars)
       Child chunks: overlapping windows within each parent (≤400 chars, 50 overlap)
  → generateEmbeddings(): Gemini embedding API, batches of 25 chunks
  → storeEmbeddings(): ChromaDB upsert
  → writeMetadata(): atomic tmp-then-rename write to documents.json
```

Uploaded files are kept on disk permanently so reindexing never requires a re-upload.

### Retrieval + Answer Pipeline

```
POST /chat
  → validate input (sessionId, question)
  → load session from SQLite (404 if not found)
  → load last 20 messages as conversation history
  → embed question via Gemini → 768-dim vector
  → ChromaDB ANN search → top-3 nearest chunks
  → convert L2 distance to cosine similarity: cos_sim = 1 − d²/2
  → drop chunks below minimumSimilarity (0.65)
  → if no chunks pass: return NOT_FOUND (skip Gemini call entirely)
  → build grounded prompt: [system instruction] + [history] + [chunks] + [question]
  → Gemini 2.5 Flash → answer text
  → SQLite transaction: INSERT user msg + INSERT assistant msg + UPDATE session
  → return { answer, sources, chunksUsed }
```

### Similarity Score Reference

```
1.00  Identical vectors
0.90  Near-exact match
0.75  Related topic
0.65  ── THRESHOLD ── below this: dropped
0.50  Weakly related
0.20  Unrelated
0.00  Orthogonal
```

---

## 9. Configuration

All tunable values live in `backend/src/config/`. Never read `process.env` in controllers or services — import from the relevant config file.

| File | Key settings |
|---|---|
| `apiConfig.js` | `port` (5000), `requestTimeout` (30s), `ingestionTimeout` (10min) |
| `chunkerConfig.js` | `parentMaxChars` (2000), `childMaxChars` (400), `childOverlapChars` (50) |
| `embeddingConfig.js` | `model` (`gemini-embedding-001`), `requestDelayMs` (0), `maxRetries` (3) |
| `retrievalConfig.js` | `topK` (3), `minimumSimilarity` (0.65) |
| `uploadConfig.js` | `maxFileSizeBytes` (10 MB), `allowedExtensions` ([`.pdf`, `.txt`]) |
| `chromaConfig.js` | `host` (localhost), `port` (8000), `collectionName` (`rag-documents`) |

**To tune retrieval quality:**
- Raise `minimumSimilarity` → fewer answers, higher precision
- Lower `minimumSimilarity` → more answers, more hallucination risk
- Raise `topK` → more candidate chunks considered per query

After changing `chunkerConfig.js` you must reindex all documents (`POST /documents/:fileName/reindex`) for the new settings to take effect.

---

## 10. Debugging Guide

### "Answer is wrong or makes no sense"

1. Check server logs for `Retrieved N chunk(s) — top score: X.XX`
2. `GET /documents/:fileName/chunks` — see how the doc was split
3. Try raising `minimumSimilarity` in `retrievalConfig.js` (e.g. 0.65 → 0.75)
4. `GET /documents/stats` — verify vectors are stored (`totalRecords > 0`)

### "Always returns 'I could not find that information'"

1. `curl localhost:5000/documents/stats` — if `totalRecords` is 0, re-upload documents
2. Check logs for `Dropped N chunk(s) below similarity threshold`
3. Try lowering `minimumSimilarity` to 0.50 temporarily

### "Upload is slow"

Expected on Gemini free tier. The embedding model is rate-limited (1500 RPM for embedding — no delay needed on current config). If you're on the legacy 5 RPM limit, a 50-chunk document takes ~10 minutes. Set `requestDelayMs: 0` if you're on a paid tier.

### "ChromaDB is unreachable" (`/health/ready` → 503)

```bash
cd backend && npm run chroma
# Wait for: Server running on http://0.0.0.0:8000
```

### "Session not found (404)"

Always call `POST /sessions` first to create a session, then use the returned `sessionId` in `POST /chat`.

### "Rate limit hit (429)"

| Endpoint | Limit |
|---|---|
| `POST /chat` | 20/min per IP |
| `POST /documents/upload` | 5/min per IP |
| `POST /documents/:fileName/reindex` | 5/min per IP |
| `POST /sessions` | 10/min per IP |

Wait 60 seconds for the window to reset.

### Request ID correlation

Every request gets a UUID `requestId` attached to all log lines and returned in the `X-Request-Id` response header. To trace a full request:

```bash
grep "abc123-your-request-id" backend/logs
```

---

## 11. Known Bugs Fixed

### Infinite loop in chunker (OOM crash) — fixed

**Symptom:** Node.js crashes with "JavaScript heap out of memory" after a few minutes when uploading `javascript_tutorial.pdf` or any document with dense text and few spaces.

**Root cause:** `splitIntoChildren()` in `textChunker.js` had a loop advancement bug. When `lastIndexOf(' ')` returned a space position that was exactly `overlapChars` ahead of the current `start`, the next `start` was computed as `end - overlapChars === start` — producing an infinite loop. Each iteration pushed a ~50-char duplicate child chunk until memory was exhausted (~10,000 identical chunks before OOM).

**Fix:** `start = Math.max(end - overlapChars, start + 1)` — guarantees start always advances by at least 1.

**File:** `backend/src/chunkers/textChunker.js`

---

### Embedding pipeline held all chunks in memory — fixed

**Symptom:** Memory pressure during ingestion of large documents even with the chunker fix.

**Root cause:** `_embedAndStore()` built the full array of all chunks before calling the Gemini API, and again after, before calling ChromaDB — holding the entire document's chunk objects + embedding vectors simultaneously.

**Fix:** Both `ingestDocument` and `reindexDocument` now process chunks in **batches of 25**: embed 25 → store 25 → release → next 25.

**File:** `backend/src/services/documentIngestionService.js`

---

## 12. Roadmap

| Phase | Status | Focus |
|---|---|---|
| Phase 1 — Backend | ✅ Complete | API, RAG pipeline, conversation memory, rate limiting |
| Phase 2 — Frontend | 🔄 In progress | React UI: session sidebar, chat interface, document upload |
| Phase 3 — Retrieval | Planned | Streaming SSE, hybrid BM25+vector search, reranking |
| Phase 4 — Multi-user | Planned | Auth (JWT/API key), per-user document libraries, PostgreSQL |
| Phase 5 — Intelligence | Future | Memory compression, agent workflows, knowledge graph |

**Phase 2 backend additions needed:**
- `DELETE /sessions/:sessionId`
- `GET /sessions/:sessionId` (single session metadata)

**Phase 3 quick wins (no infrastructure change):**
- Streaming via `POST /chat/stream` + `ai.models.generateContentStream()`
- Hybrid search via SQLite FTS5 (built-in, no new dependency)
- Increase `topK` in `retrievalConfig.js` for multi-section questions

**Full roadmap details:** [backend/docs/FUTURE_ROADMAP.md](backend/docs/FUTURE_ROADMAP.md)  
**Deep architecture reference:** [backend/docs/PROJECT_ARCHITECTURE.md](backend/docs/PROJECT_ARCHITECTURE.md)  
**Developer onboarding:** [backend/docs/DEVELOPER_ONBOARDING.md](backend/docs/DEVELOPER_ONBOARDING.md)

---

## Contributing / Development

**Add a new API endpoint:** service function → controller handler → route registration → startup log. Follow the pattern in `backend/src/api/controllers/documentController.js`.

**Add a new document type:** install parser → add extension to `uploadConfig.js` → add extraction branch in `extractText()` in `documentIngestionService.js`. Everything downstream (chunking, embedding, retrieval) works unchanged.

**Layer boundaries:**

| Layer | Does | Must NOT |
|---|---|---|
| `routes/` | Register paths, attach middleware | Contain business logic |
| `controllers/` | Parse HTTP input, call services, shape response | Talk to DB or Chroma directly |
| `services/` | Orchestrate business logic | Know about HTTP (req/res) |
| `config/` | Export constants | Perform I/O |
| `database/` | Manage SQLite connection + schema | Know about Express |
| `vectorstore/` | Manage ChromaDB connection + collection | Know about chunking or embeddings |

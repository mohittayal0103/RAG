# Developer Onboarding Guide — RAG Document Assistant

> **Goal:** Understand this entire project in under 30 minutes.
>
> **Audience:** Junior-to-mid developer joining the project for the first time.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Request Lifecycle](#3-request-lifecycle)
4. [Document Ingestion Lifecycle](#4-document-ingestion-lifecycle)
5. [Retrieval Lifecycle](#5-retrieval-lifecycle)
6. [Conversation Memory Lifecycle](#6-conversation-memory-lifecycle)
7. [Database Overview](#7-database-overview)
8. [Folder Structure](#8-folder-structure)
9. [Key Files Every Developer Should Know](#9-key-files-every-developer-should-know)
10. [Common Debugging Scenarios](#10-common-debugging-scenarios)
11. [How to Run Locally](#11-how-to-run-locally)
12. [How to Add a New API Endpoint](#12-how-to-add-a-new-api-endpoint)
13. [How to Add a New Document Type](#13-how-to-add-a-new-document-type)
14. [Future Roadmap](#14-future-roadmap)

---

## 1. What This Project Is

This is a **document question-answering API**. Users:

1. Upload documents (PDF, TXT, or Markdown files).
2. Ask natural-language questions about those documents.
3. Get accurate, grounded answers — with citations to source chunks.
4. Have multi-turn conversations where follow-up questions reference previous answers.

**Example interaction:**

```
User uploads: react-hooks.txt

User asks:    "What is useState?"
System:       "useState is a React Hook that lets you add state to a functional
               component. It returns an array with two elements: the current
               state value and a setter function."

User asks:    "What does it return?"
System:       "It returns an array: [currentStateValue, setterFunction]. The
               setter function updates the state and triggers a re-render."
```

The system knows what "it" refers to in the second question because it stores the full conversation and includes the last 20 messages as context in every new request.

**What it is NOT:**
- It is not a general chatbot. It only answers questions grounded in uploaded documents.
- It does not have authentication. There is a single global document collection visible to all users.
- It does not have a frontend. It is a pure REST API.

---

## 2. High-Level Architecture

```
┌─────────────┐       ┌─────────────────────────────────────────────────┐
│   Client    │       │               Node.js / Express API              │
│  (curl /    │──────▶│                                                 │
│  frontend)  │       │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
└─────────────┘       │  │  /chat   │  │/documents│  │  /sessions   │ │
                      │  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
                      └───────┼─────────────┼───────────────┼─────────┘
                              │             │               │
                    ┌─────────▼───┐   ┌─────▼──────┐  ┌───▼──────────┐
                    │  ChromaDB   │   │  Gemini API │  │   SQLite     │
                    │ (port 8000) │   │ (embeddings │  │  (rag.db)    │
                    │  vectors    │   │ + answers)  │  │  sessions +  │
                    └─────────────┘   └─────────────┘  │  messages   │
                                                        └─────────────┘
```

Three external dependencies:
- **ChromaDB** — runs locally on port 8000. Stores document embedding vectors.
- **Gemini API** — Google's AI models. Used for both embedding text and generating answers.
- **SQLite** — embedded database (no separate process). Stores conversation sessions and messages.

---

## 3. Request Lifecycle

When a user sends `POST /chat`:

```
Client
  │
  ▼
Express middleware
  │  1. Attach UUID request ID (req.requestId)
  │  2. Start request timeout timer (30s)
  │  3. Parse JSON body
  │  4. Check rate limit (max 20/min per IP)
  │
  ▼
chatController.js
  │  5. Validate sessionId (must exist, ≤128 chars)
  │  6. Validate question (non-empty, ≤2000 chars)
  │  7. Look up session in SQLite — return 404 if not found
  │  8. Load last 20 messages from SQLite as conversation history
  │
  ▼
answerGenerator.js
  │  9. Call retriever to find relevant document chunks
  │  10. If no qualifying chunks: return "not found" (skip Gemini call)
  │  11. Build prompt: history + retrieved context + question
  │  12. Call Gemini 2.5 Flash → get answer text
  │
  ▼
sessionService.js (saveExchange)
  │  13. Write user message + assistant message + session update
  │      — all in one SQLite transaction
  │
  ▼
Client receives:
  { success: true, answer: "...", sources: [...], chunksUsed: N }
```

**Key insight:** Steps 13 (database write) happens AFTER the answer is generated. If Gemini fails, nothing is written to the database. If the database write fails, the answer was already generated — the client still gets the answer even if persistence failed.

---

## 4. Document Ingestion Lifecycle

When a user uploads a file with `POST /documents/upload`:

```
1. Client sends: multipart/form-data with field "file"

2. multer (documentRoutes.js)
   - Validates file extension (.pdf, .txt, .md only)
   - Validates file size (max 10 MB)
   - Saves file to src/uploads/<safeFileName>

3. documentController.js → ingestDocument()

4. documentIngestionService.js:
   ├─ Check for duplicate (same fileName already in documents.json?) → 409
   ├─ Check if upload is already in-progress (concurrent upload guard) → 409
   ├─ Extract text:
   │    .pdf → pdf-parse library (magic byte detection)
   │    .txt / .md → fs.readFileSync UTF-8
   ├─ Assign permanent documentId (UUID v4) — never changes
   ├─ Chunk text into overlapping 1000-char windows (200-char overlap)
   ├─ For each chunk: call Gemini embedding API → 768-dim vector
   │    (12s pause between calls on free tier)
   ├─ Store all vectors in ChromaDB (upsert)
   └─ Append metadata to documents.json (atomic write: .tmp → rename)

5. Response: { success: true, documentId, fileName, chunksCreated, vectorsStored }
```

**Why files are kept on disk:** So you can re-index them later when embedding models improve, without requiring a new upload.

**Why atomic writes:** If the server crashes mid-write, `documents.json` is never left in a partially-written (corrupt) state. Only a complete payload is ever swapped into place.

---

## 5. Retrieval Lifecycle

When `answerGenerator.js` calls `searchSimilarChunks(question)`:

```
1. Embed the question
   → call Gemini embedding API with the question text
   → get back a 768-dimensional vector

2. Query ChromaDB
   → ask for top-3 most similar vectors (configurable: RETRIEVAL_CONFIG.topK)
   → ChromaDB returns chunk text + metadata + L2 distances

3. Convert distances to similarity scores
   → cos_sim = 1 - (L2_distance² / 2)
   → This works because Gemini embeddings are unit-normalised (length = 1)
   → Score range: 0.0 (completely unrelated) → 1.0 (identical)

4. Apply quality threshold
   → Drop any chunk with score < 0.65 (configurable: RETRIEVAL_CONFIG.minimumSimilarity)
   → If ALL chunks are dropped: return []

5. answerGenerator.js checks:
   → If [] → return "I could not find that information in the documents." (no Gemini call)
   → If chunks present → build prompt → call Gemini 2.5 Flash
```

**Why the threshold exists:** ChromaDB always returns results, even for off-topic questions. Without a threshold, "what is the weather?" would retrieve unrelated document chunks and Gemini would hallucinate an answer. The threshold makes the system say "I don't know" instead.

---

## 6. Conversation Memory Lifecycle

```
Session creation (POST /sessions):
  → INSERT into sessions table (id, title=NULL, created_at, updated_at)
  → Return { sessionId }

Each chat exchange (POST /chat):
  → READ: SELECT last 20 messages WHERE session_id = ? (chronological)
  → The 20 messages are passed as "history" to the prompt builder
  → WRITE (single transaction after answer is generated):
       INSERT user message  (role='user',      content=question, created_at=now)
       INSERT asst message  (role='assistant', content=answer,   created_at=now+1ms)
       UPDATE session       (title=first_question if NULL, updated_at=now+1ms)

Viewing history (GET /sessions/:sessionId/messages):
  → SELECT last N messages, sorted chronological
  → Return [{role, content}, ...]

Listing sessions (GET /sessions):
  → SELECT all sessions ORDER BY updated_at DESC
  → Return [{id, title, createdAt, updatedAt}, ...]
```

**Why 1ms offset between messages:** User and assistant messages in the same exchange need different timestamps so the `ORDER BY created_at ASC` sort is deterministic. Without the offset, both messages get the same millisecond timestamp and the sort order is undefined.

**Why `AND title IS NULL` in the UPDATE:** This makes the title-setting atomic. Two simultaneous first requests cannot both try to set the title — only the first one to run the UPDATE will match the `AND title IS NULL` condition.

---

## 7. Database Overview

SQLite database file: `src/database/rag.db`

**Two tables:**

```
sessions
  id         TEXT  PRIMARY KEY   ← UUID v4
  title      TEXT  nullable      ← first question (≤100 chars), set on first exchange
  created_at DATETIME NOT NULL   ← ISO-8601 string
  updated_at DATETIME NOT NULL   ← bumped on every exchange

messages
  id         TEXT  PRIMARY KEY   ← UUID v4
  session_id TEXT  NOT NULL      ← FK → sessions.id
  role       TEXT  NOT NULL      ← 'user' | 'assistant'
  content    TEXT  NOT NULL      ← truncated to 2000/4000 chars
  created_at DATETIME NOT NULL   ← ISO-8601 string
  FOREIGN KEY (session_id) REFERENCES sessions(id)
```

**Two indexes:**

```sql
idx_messages_session_id ON messages(session_id, created_at)
  → Used by getSessionMessages: WHERE session_id = ? ORDER BY created_at
  → Without this, loading history does a full table scan

idx_sessions_updated_at ON sessions(updated_at DESC)
  → Used by listSessions: ORDER BY updated_at DESC
  → Without this, listing sessions requires sorting all rows
```

**Key settings (in `src/database/sqlite.js`):**

```js
db.pragma('journal_mode = WAL');   // concurrent reads never block
db.pragma('foreign_keys = ON');    // enforce session_id FK constraint
```

---

## 8. Folder Structure

```
Project1/
├── src/
│   ├── api/
│   │   ├── app.js                 ← Express app (middleware + routes)
│   │   ├── server.js              ← Process entry point (bootstrap + listen)
│   │   ├── controllers/
│   │   │   ├── chatController.js      ← POST /chat
│   │   │   ├── documentController.js  ← All /documents/* endpoints
│   │   │   ├── healthController.js    ← GET /health, GET /health/ready
│   │   │   └── sessionController.js   ← All /sessions/* endpoints
│   │   └── routes/
│   │       ├── chatRoutes.js          ← rate limiter + route registration
│   │       ├── documentRoutes.js      ← multer + rate limiters + routes
│   │       ├── healthRoutes.js
│   │       └── sessionRoutes.js       ← session creation rate limiter
│   │
│   ├── chunkers/
│   │   └── textChunker.js         ← sliding window chunker (1000 chars, 200 overlap)
│   │
│   ├── config/
│   │   ├── apiConfig.js           ← PORT, timeouts, log level
│   │   ├── chromaConfig.js        ← ChromaDB host, port, collection name
│   │   ├── chunkerConfig.js       ← chunkSize, overlap
│   │   ├── embeddingConfig.js     ← model name, rate-limit delay, retry config
│   │   ├── paths.js               ← DOCS_DIR (legacy batch ingestion)
│   │   ├── retrievalConfig.js     ← topK, minimumSimilarity threshold
│   │   └── uploadConfig.js        ← uploadDir, metadataFile, maxSize, allowedExtensions
│   │
│   ├── database/
│   │   ├── initDatabase.js        ← CREATE TABLE IF NOT EXISTS (runs at startup)
│   │   ├── rag.db                 ← SQLite database file (created on first run)
│   │   └── sqlite.js              ← singleton getDb() with WAL + FK pragmas
│   │
│   ├── data/
│   │   └── documents.json         ← metadata index of all ingested documents
│   │
│   ├── embeddings/
│   │   └── embeddingService.js    ← calls Gemini embedding API, handles retries
│   │
│   ├── loaders/
│   │   └── pdfLoader.js           ← legacy batch PDF loader (not used by the API)
│   │
│   ├── rag/
│   │   └── answerGenerator.js     ← builds prompt, calls Gemini 2.5 Flash
│   │
│   ├── retrieval/
│   │   └── retriever.js           ← embed question → query ChromaDB → filter by threshold
│   │
│   ├── services/
│   │   ├── documentIngestionService.js  ← full ingest/reindex/delete pipeline
│   │   └── sessionService.js            ← all SQLite CRUD for sessions + messages
│   │
│   ├── uploads/                   ← uploaded files live here (PDF, TXT, MD)
│   │
│   ├── utils/
│   │   ├── bootstrap.js           ← creates uploads/ and data/ directories on startup
│   │   └── logger.js              ← simple console logger with timestamps
│   │
│   └── vectorstore/
│       └── chromaService.js       ← ChromaDB client: initialize, upsert, query, stats
│
├── docs/
│   ├── DEVELOPER_ONBOARDING.md   ← this file
│   └── FUTURE_ROADMAP.md         ← planned future work
│
├── PROJECT_ARCHITECTURE.md       ← deep-dive architecture reference (20+ sections)
├── package.json
├── .env                           ← GEMINI_API_KEY (not committed to git)
└── chroma-data/                   ← ChromaDB persistence directory (created by ChromaDB)
```

---

## 9. Key Files Every Developer Should Know

These are the files you will touch most often and need to understand first.

---

### `src/api/server.js`

**What it does:** The process entry point. Runs bootstrap, initialises the database, then starts listening.

**Why it matters:** This is where you add new startup checks. The order of operations matters: `ensureDirectoriesExist()` and `initDatabase()` must complete before `app.listen()`.

---

### `src/api/app.js`

**What it does:** Assembles the Express application: attaches request IDs, timeout middleware, CORS, body parser, request logger, all route handlers, the 404 handler, and the centralized error handler.

**Why it matters:** Middleware order is significant. The request ID middleware must run first (all subsequent middleware and controllers depend on `req.requestId`). The error handler must be last and have exactly 4 parameters.

---

### `src/services/sessionService.js`

**What it does:** All SQLite operations for sessions and messages. The most important function is `saveExchange()` — it writes user message + assistant message + session update in a single atomic transaction.

**Why it matters:** This is the heart of conversation memory. Every `POST /chat` reads from and writes to this service. Understand `saveExchange()` and `getSessionMessages()` thoroughly.

---

### `src/services/documentIngestionService.js`

**What it does:** Orchestrates the full ingest pipeline: extract → chunk → embed → store → save metadata. Also handles reindex and delete.

**Why it matters:** Most bug reports about "document not found" or "wrong answer" trace back here. The `documentId` vs `fileName` distinction is critical — vectors are always keyed by `documentId`, never `fileName`.

---

### `src/rag/answerGenerator.js`

**What it does:** Calls the retriever, builds the grounded prompt (with history and trust-boundary labels), calls Gemini, and returns the answer.

**Why it matters:** This is where prompt engineering happens. If you need to change how the LLM is instructed, what context it sees, or how it handles conversation history — this is the file.

---

### `src/retrieval/retriever.js`

**What it does:** Embeds the question, queries ChromaDB for top-K chunks, converts L2 distances to cosine similarity scores, filters by threshold, and returns qualifying chunks.

**Why it matters:** This file controls retrieval quality. The `minimumSimilarity` threshold and `topK` setting in `src/config/retrievalConfig.js` directly affect whether the system finds good answers or says "not found."

---

### `src/config/` (all files)

**What they do:** Single source of truth for all tunable values. No controller or service should read `process.env` directly — they import from the appropriate config file.

**Why it matters:** If you need to change a limit, threshold, timeout, or model name — look in `src/config/` first. Changes here propagate everywhere automatically.

---

## 10. Common Debugging Scenarios

---

### "The answer is wrong or makes no sense"

**Most likely cause:** Retrieval is returning unrelated chunks, or the similarity threshold is too low.

**Debug steps:**
1. Check what chunks were retrieved: look for the log line `Retrieved N chunk(s) — top score: X.XXXXXX`.
2. Call `GET /documents/:fileName/chunks` to see how the document was split.
3. Try raising `minimumSimilarity` in `src/config/retrievalConfig.js` (e.g. from 0.65 to 0.75).
4. Check `GET /documents/stats` to verify vectors are actually stored.

---

### "The system always says 'I could not find that information'"

**Most likely causes:**
- No documents are uploaded yet.
- The question is off-topic (similarity scores all below threshold).
- ChromaDB is empty (vectors were lost).
- The similarity threshold is set too high.

**Debug steps:**
1. `curl http://localhost:5000/documents/stats` — check `totalRecords`. If 0, re-upload documents.
2. Check server logs for lines like `Dropped N chunk(s) below similarity threshold`.
3. Temporarily lower `minimumSimilarity` to 0.50 and re-test.

---

### "Upload is taking forever"

**Cause:** Expected on the Gemini free tier. The embedding service pauses 12 seconds between each API call (5 RPM limit). A document with 10 chunks takes approximately 10 × 12 = 120 seconds.

**Fix for development:** If you are on a paid Gemini tier, set `requestDelayMs: 0` in `src/config/embeddingConfig.js`.

---

### "Session not found (404)"

**Most likely cause:** The `sessionId` in the request body was never created, or the session was never persisted.

**Debug steps:**
1. First call `POST /sessions` to create a session and get back a `sessionId`.
2. Use that exact `sessionId` in the `POST /chat` body.
3. Check `GET /sessions` to list all known sessions.

---

### "ChromaDB is unreachable"

**Cause:** ChromaDB server is not running.

**Fix:** Open a terminal and run `npm run chroma`. Wait until you see `Server running on http://0.0.0.0:8000`.

---

### "Messages come back in wrong order"

**Cause:** Old bug (fixed). If you see this on a fresh install, check that `src/services/sessionService.js` uses `userNow` and `asstNow` (1ms apart) as separate timestamps in `saveExchange()`. Both timestamps being identical caused non-deterministic sort order.

---

### "Rate limit hit (429)"

**Cause:** Too many requests from the same IP within the time window.

**Limits:**
- `POST /chat`: 20/min
- `POST /documents/upload`: 5/min
- `POST /documents/:fileName/reindex`: 5/min
- `POST /sessions`: 10/min

**Fix:** Wait 1 minute for the window to reset. For load testing, use different IP addresses or temporarily increase the limits in the route files.

---

### "documents.json is empty after restart"

**Cause:** If you see this, a crash happened mid-write in an older version. The current version uses atomic writes (`writeMetadata()` writes to `.tmp` then renames) so this should not occur.

**Fix:** The `.tmp` orphan (if present) can be deleted. If `documents.json` is empty, you will need to re-upload and re-index all documents.

---

## 11. How to Run Locally

### Quick start (assumes Node.js, Python, and pip are installed):

```bash
# 1. Install Node dependencies
npm install

# 2. Install ChromaDB
pip3 install chromadb

# 3. Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# 4. Terminal 1: start ChromaDB
npm run chroma

# 5. Terminal 2: start the API
npm run dev:api

# 6. Verify both are running
curl http://localhost:5000/health/ready
# Expected: {"status":"ready"}
```

### Full walkthrough

See **Section 24** of `PROJECT_ARCHITECTURE.md` for a complete step-by-step guide including environment variables, health checks, and an end-to-end test flow.

---

## 12. How to Add a New API Endpoint

Follow this pattern to add a new endpoint without breaking anything.

**Example: `GET /documents/:fileName/text` — return raw extracted text**

---

### Step 1 — Add the service function

In `src/services/documentIngestionService.js` (or create a new service file):

```js
async function getDocumentText(fileName) {
  const record = readMetadata().find((r) => r.fileName === fileName);
  if (!record) return null;

  const filePath = path.join(UPLOAD_CONFIG.uploadDir, fileName);
  if (!fs.existsSync(filePath)) return null;

  return await extractText(filePath, fileName);
}

module.exports = {
  // ... existing exports ...
  getDocumentText,
};
```

---

### Step 2 — Add the controller handler

In `src/api/controllers/documentController.js`:

```js
const { getDocumentText } = require('../../services/documentIngestionService');

async function getText(req, res, next) {
  const id       = req.requestId;
  const fileName = sanitizeFileName(req.params.fileName, res, id);
  if (!fileName) return;

  try {
    const text = await getDocumentText(fileName);
    if (!text) {
      return res.status(404).json({
        success: false, error: `Document not found: "${fileName}"`, requestId: id,
      });
    }
    return res.json({ fileName, text });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, upload, getStats, getDetails, getChunks, reindex, remove, getText };
```

---

### Step 3 — Register the route

In `src/api/routes/documentRoutes.js`:

```js
const { list, upload, getStats, getDetails, getChunks, reindex, remove, getText } =
  require('../controllers/documentController');

// Add BEFORE the /:fileName route to avoid conflict
router.get('/:fileName/text', getText);
```

**Important:** Sub-path routes (`:fileName/text`) must be registered before the bare `/:fileName` route. Express matches top-to-bottom.

---

### Step 4 — Test

```bash
curl http://localhost:5000/documents/react-hooks.txt/text
```

---

### Step 5 — Update startup log (optional but good practice)

In `src/api/server.js`, add to the logger block:

```js
logger.info('  GET    /documents/:fileName/text');
```

---

## 13. How to Add a New Document Type

**Example: Add support for `.docx` (Microsoft Word) files**

---

### Step 1 — Install a parser library

```bash
npm install mammoth
```

---

### Step 2 — Allow the extension in upload config

In `src/config/uploadConfig.js`:

```js
allowedExtensions: ['.pdf', '.txt', '.md', '.docx'],  // add '.docx'
```

---

### Step 3 — Add extraction logic

In `src/services/documentIngestionService.js`, inside the `extractText()` function:

```js
async function extractText(filePath, fileName) {
  const buffer = fs.readFileSync(filePath);
  const ext    = path.extname(fileName).toLowerCase();

  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  const isBinaryPDF = buffer.slice(0, 5).toString('ascii') === '%PDF-';
  if (ext === '.pdf' && isBinaryPDF) {
    // ... existing PDF logic ...
  }

  return buffer.toString('utf-8').trim();
}
```

---

### Step 4 — Test

```bash
curl -X POST http://localhost:5000/documents/upload \
  -F "file=@your-document.docx"
```

**That is all.** The rest of the pipeline (chunking, embedding, storage, retrieval, deletion) works identically for every document type because they all produce plain text after extraction.

---

## 14. Future Roadmap

See `docs/FUTURE_ROADMAP.md` for the full planned roadmap with timelines and implementation notes.

**Summary of phases:**

| Phase | Focus | Key features |
|-------|-------|-------------|
| Phase 2 | Frontend | React UI: session sidebar, chat interface, document upload panel |
| Phase 3 | Retrieval quality | Streaming responses, hybrid search (BM25 + vector), reranking |
| Phase 4 | Multi-user | Authentication, PostgreSQL migration, cloud document storage |
| Phase 5 | Intelligence | Advanced memory compression, agent workflows, knowledge graph |

The current backend API is designed to support all of these phases without breaking changes:
- `GET /sessions` is already the session sidebar data source.
- `GET /sessions/:id/messages` is already the conversation history source.
- `POST /chat` is already the answer endpoint.
- `GET /documents` is already the document library source.

A React frontend is a **thin presentation layer** over the existing API — no backend changes are required to add it.

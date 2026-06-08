const { loadAllPDFs }          = require('./loaders/pdfLoader');
const { chunkDocuments }       = require('./chunkers/textChunker');
const { generateEmbeddings }   = require('./embeddings/embeddingService');
const { storeEmbeddings, getCollectionStats } = require('./vectorstore/chromaService');
const { searchSimilarChunks }  = require('./retrieval/retriever');
const logger                   = require('./utils/logger');

const MIN_RECORDS_NEEDED = 10; // repopulate if the collection has fewer than this
const TOP_K = 3;

const TEST_QUESTIONS = [
  'What is useState?',
  'How do I create an Express server?',
  'What is MongoDB aggregation?',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function bar(score) {
  const filled = Math.round(score * 20);
  return '[' + '█'.repeat(filled) + '░'.repeat(20 - filled) + ']';
}

function printResults(question, chunks) {
  console.log('\n' + '═'.repeat(68));
  console.log(`  Q: "${question}"`);
  console.log('═'.repeat(68));

  if (chunks.length === 0) {
    console.log('  No results found.');
    return;
  }

  chunks.forEach((chunk, i) => {
    const score = chunk.similarityScore;
    console.log(`\n  ── Result ${i + 1} of ${chunks.length} ${'─'.repeat(44)}`);
    console.log(`  id          : ${chunk.id}`);
    console.log(`  source      : ${chunk.source}`);
    console.log(`  chunkIndex  : ${chunk.chunkIndex}`);
    console.log(`  similarity  : ${score.toFixed(6)}  ${bar(score)}`);
    console.log(`  text preview:`);
    // Wrap at 60 chars for readability
    const preview = chunk.text.slice(0, 300).replace(/\n+/g, ' ').trim();
    const words = preview.split(' ');
    let line = '    ';
    words.forEach((w) => {
      if ((line + w).length > 64) { console.log(line); line = '    ' + w + ' '; }
      else line += w + ' ';
    });
    if (line.trim()) console.log(line);
  });
}

// ── Pipeline helpers ─────────────────────────────────────────────────────────

async function ensureCollectionPopulated() {
  const { totalRecords } = await getCollectionStats();
  logger.info(`Collection currently holds ${totalRecords} record(s)`);

  if (totalRecords >= MIN_RECORDS_NEEDED) {
    logger.info('Collection is sufficiently populated — skipping ingest');
    return;
  }

  logger.info(`Below threshold (${MIN_RECORDS_NEEDED}) — running full ingest pipeline...`);

  const documents = await loadAllPDFs();
  if (documents.length === 0) {
    throw new Error('No documents found in /docs. Cannot populate collection.');
  }

  const chunks   = chunkDocuments(documents);
  const embedded = await generateEmbeddings(chunks);   // embeds ALL chunks
  await storeEmbeddings(embedded);

  const after = await getCollectionStats();
  logger.info(`Collection now holds ${after.totalRecords} record(s)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('=== RAG Document Assistant — Step 5: Retrieval Test ===\n');

  // Step 1 — make sure ChromaDB has enough data to search
  await ensureCollectionPopulated();

  // Step 2 — run each test question
  logger.info(`\nRunning ${TEST_QUESTIONS.length} test question(s) with topK=${TOP_K}...\n`);

  for (const question of TEST_QUESTIONS) {
    try {
      const chunks = await searchSimilarChunks(question, TOP_K);
      printResults(question, chunks);
    } catch (err) {
      logger.error(`Failed to retrieve for "${question}": ${err.message}`);
    }
  }

  console.log('\n' + '═'.repeat(68));
  logger.info('Step 5 complete. Retrieval is working.');
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});

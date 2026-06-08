const { loadAllPDFs }          = require('./loaders/pdfLoader');
const { chunkDocuments }       = require('./chunkers/textChunker');
const { generateEmbeddings }   = require('./embeddings/embeddingService');
const { storeEmbeddings, getCollectionStats } = require('./vectorstore/chromaService');
const logger                   = require('./utils/logger');

// By default embed + store only the first 3 chunks (free-tier rate limit safety).
// Pass EMBED_ALL=true to process every chunk.
const EMBED_ALL    = process.argv.includes('EMBED_ALL=true');
const SAMPLE_LIMIT = 3;

async function main() {
  logger.info('=== RAG Document Assistant — Step 4: ChromaDB Integration ===\n');

  // ── 1. Load PDFs ──────────────────────────────────────────────────────────
  const documents = await loadAllPDFs();
  if (documents.length === 0) {
    logger.warn('No documents found in /docs. Aborting.');
    return;
  }

  // ── 2. Chunk ──────────────────────────────────────────────────────────────
  const allChunks = chunkDocuments(documents);
  logger.info(`Total chunks produced: ${allChunks.length}`);

  // ── 3. Select chunks to embed ─────────────────────────────────────────────
  const chunksToEmbed = EMBED_ALL ? allChunks : allChunks.slice(0, SAMPLE_LIMIT);

  if (!EMBED_ALL) {
    logger.info(`Sample mode: processing first ${SAMPLE_LIMIT} chunk(s) only.`);
    logger.info('Pass EMBED_ALL=true to process all chunks.\n');
  }

  // ── 4. Generate embeddings ────────────────────────────────────────────────
  const embedded = await generateEmbeddings(chunksToEmbed);
  if (embedded.length === 0) {
    logger.error('No embeddings generated. Check GEMINI_API_KEY. Aborting.');
    return;
  }

  // ── 5. Store in ChromaDB ──────────────────────────────────────────────────
  const { stored, skipped } = await storeEmbeddings(embedded);

  // ── 6. Retrieve collection stats ──────────────────────────────────────────
  const stats = await getCollectionStats();

  // ── 7. Print report ───────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('  CHROMADB STORAGE REPORT');
  console.log('═'.repeat(64));
  console.log(`  Collection name  : ${stats.collectionName}`);
  console.log(`  Total records    : ${stats.totalRecords}`);
  console.log(`  Stored this run  : ${stored}`);
  console.log(`  Skipped (no vec) : ${skipped}`);
  console.log(`  Vector dimensions: ${embedded[0]?.dimensions ?? 'n/a'}`);

  console.log('\n' + '─'.repeat(64));
  console.log('  SAMPLE RECORDS');
  console.log('─'.repeat(64));

  if (stats.sample.length === 0) {
    console.log('  (no records found)');
  } else {
    stats.sample.forEach((rec, i) => {
      console.log(`\n  [${i + 1}]`);
      console.log(`    id          : ${rec.id}`);
      console.log(`    source      : ${rec.source}`);
      console.log(`    chunkIndex  : ${rec.chunkIndex}`);
      console.log(`    text preview: ${rec.textPreview}`);
    });
  }

  console.log('\n' + '═'.repeat(64));
  logger.info('Step 4 complete. ChromaDB is populated and ready for similarity search.');
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});

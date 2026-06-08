const { loadAllPDFs }          = require('./loaders/pdfLoader');
const { chunkDocuments }       = require('./chunkers/textChunker');
const { generateEmbeddings }   = require('./embeddings/embeddingService');
const logger                   = require('./utils/logger');

// For the full test: set EMBED_ALL=true  (node src/testEmbeddings.js EMBED_ALL=true)
// By default we only embed the first 3 chunks to stay within free-tier rate limits.
const EMBED_ALL   = process.argv.includes('EMBED_ALL=true');
const SAMPLE_LIMIT = 3;

async function main() {
  logger.info('=== RAG Document Assistant — Step 3: Embedding Test ===\n');

  // ── 1. Load PDFs ─────────────────────────────────────────────────────────
  const documents = await loadAllPDFs();
  if (documents.length === 0) {
    logger.warn('No documents loaded. Add PDF files to /docs and retry.');
    return;
  }

  // ── 2. Chunk ──────────────────────────────────────────────────────────────
  const allChunks = chunkDocuments(documents);
  logger.info(`Total chunks available: ${allChunks.length}`);

  // ── 3. Select chunks to embed ─────────────────────────────────────────────
  const chunksToEmbed = EMBED_ALL ? allChunks : allChunks.slice(0, SAMPLE_LIMIT);

  if (!EMBED_ALL) {
    logger.info(`Sample mode: embedding first ${SAMPLE_LIMIT} chunk(s) only.`);
    logger.info('Run with "EMBED_ALL=true" to embed all chunks.\n');
  }

  // ── 4. Generate embeddings ────────────────────────────────────────────────
  const embedded = await generateEmbeddings(chunksToEmbed);

  if (embedded.length === 0) {
    logger.error('No embeddings were generated. Check your GEMINI_API_KEY and network.');
    return;
  }

  // ── 5. Print report ───────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('  EMBEDDING REPORT');
  console.log('═'.repeat(64));
  console.log(`  Chunks submitted   : ${chunksToEmbed.length}`);
  console.log(`  Embeddings returned: ${embedded.length}`);
  console.log(`  Vector dimensions  : ${embedded[0].dimensions}`);
  console.log(`  Model              : gemini-embedding-001`);

  // Vector magnitude sanity check — a zero vector means something went wrong.
  const magnitudes = embedded.map((e) => {
    const sumSq = e.vector.reduce((acc, v) => acc + v * v, 0);
    return Math.sqrt(sumSq).toFixed(6);
  });
  console.log(`\n  Vector magnitudes (should be ~1.0 for normalized vectors):`);
  magnitudes.forEach((mag, i) => {
    console.log(`    [${i}] ${embedded[i].id.padEnd(36)} magnitude: ${mag}`);
  });

  // ── 6. Sample vector details ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('  SAMPLE VECTOR — first chunk');
  console.log('═'.repeat(64));
  const sample = embedded[0];
  console.log(`  id         : ${sample.id}`);
  console.log(`  source     : ${sample.source}`);
  console.log(`  chunkIndex : ${sample.chunkIndex}`);
  console.log(`  dimensions : ${sample.dimensions}`);
  console.log(`  text (first 120 chars):`);
  console.log(`    ${sample.text.slice(0, 120).replace(/\n/g, ' ')}`);
  console.log(`\n  First 10 vector values:`);
  sample.vector.slice(0, 10).forEach((v, i) => {
    console.log(`    [${String(i).padStart(2, '0')}]  ${v}`);
  });

  // ── 7. Cosine similarity spot-check (if ≥ 2 embeddings) ──────────────────
  if (embedded.length >= 2) {
    const cosine = (a, b) => {
      const dot    = a.reduce((s, v, i) => s + v * b[i], 0);
      const magA   = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
      const magB   = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
      return (dot / (magA * magB)).toFixed(6);
    };

    console.log('\n' + '═'.repeat(64));
    console.log('  COSINE SIMILARITY (spot-check)');
    console.log('═'.repeat(64));
    for (let i = 0; i < embedded.length - 1; i++) {
      const sim = cosine(embedded[i].vector, embedded[i + 1].vector);
      console.log(`  chunk[${i}] ↔ chunk[${i + 1}]  →  ${sim}`);
    }
    console.log('\n  (1.0 = identical  |  0.0 = unrelated  |  negative = opposite)');
  }

  console.log('\n' + '═'.repeat(64));
  logger.info('Step 3 complete.');
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});

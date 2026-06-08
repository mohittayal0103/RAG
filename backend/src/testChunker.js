const { loadAllPDFs }    = require('./loaders/pdfLoader');
const { chunkDocuments } = require('./chunkers/textChunker');
const logger             = require('./utils/logger');

const SAMPLE_CHUNKS = 2; // how many full sample chunks to print per document

async function main() {
  logger.info('=== RAG Document Assistant — Step 2: Text Chunker Test ===\n');

  // ── 1. Load PDFs ──────────────────────────────────────────────────────────
  const documents = await loadAllPDFs();

  if (documents.length === 0) {
    logger.warn('No documents loaded. Add PDF files to /docs and retry.');
    return;
  }

  // ── 2. Chunk all documents ─────────────────────────────────────────────────
  const chunks = chunkDocuments(documents);

  // ── 3. Summary ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('  CHUNKING SUMMARY');
  console.log('═'.repeat(64));
  console.log(`  Documents loaded : ${documents.length}`);
  console.log(`  Total chunks     : ${chunks.length}`);

  // Per-document breakdown
  const bySource = chunks.reduce((acc, c) => {
    acc[c.source] = acc[c.source] || [];
    acc[c.source].push(c);
    return acc;
  }, {});

  console.log('\n  Per-document breakdown:');
  for (const [source, docChunks] of Object.entries(bySource)) {
    const sizes = docChunks.map((c) => c.text.length);
    const min   = Math.min(...sizes);
    const max   = Math.max(...sizes);
    const avg   = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
    console.log(`    • ${source}`);
    console.log(`        chunks: ${docChunks.length}  |  min: ${min}  max: ${max}  avg: ${avg} chars`);
  }

  // Chunk size distribution across ALL chunks
  const allSizes = chunks.map((c) => c.text.length);
  console.log('\n  Overall chunk sizes:');
  console.log(`    min : ${Math.min(...allSizes)} chars`);
  console.log(`    max : ${Math.max(...allSizes)} chars`);
  console.log(`    avg : ${Math.round(allSizes.reduce((a, b) => a + b, 0) / allSizes.length)} chars`);

  // ── 4. Sample chunks ───────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('  SAMPLE CHUNKS');
  console.log('═'.repeat(64));

  for (const [source, docChunks] of Object.entries(bySource)) {
    console.log(`\n  [ ${source} ] — showing first ${Math.min(SAMPLE_CHUNKS, docChunks.length)} of ${docChunks.length} chunk(s)\n`);

    docChunks.slice(0, SAMPLE_CHUNKS).forEach((chunk) => {
      console.log(`  ┌─ id         : ${chunk.id}`);
      console.log(`  │  source     : ${chunk.source}`);
      console.log(`  │  chunkIndex : ${chunk.chunkIndex}`);
      console.log(`  │  length     : ${chunk.text.length} chars`);
      console.log(`  └─ text preview (first 300 chars):`);
      console.log(`     ${chunk.text.slice(0, 300).replace(/\n/g, '\n     ')}`);
      console.log('');
    });

    // Show the overlap between chunk 0 and chunk 1 (if both exist)
    if (docChunks.length >= 2) {
      const tail  = docChunks[0].text.slice(-100);
      const head  = docChunks[1].text.slice(0, 100);
      const overlapVisible = tail.split(' ').filter((w) => head.includes(w)).length;
      console.log(`  ↔  Overlap check (chunk 0 tail vs chunk 1 head): ~${overlapVisible} shared word(s)`);
      console.log(`     Chunk 0 tail : ...${tail.trim()}`);
      console.log(`     Chunk 1 head : ${head.trim()}...`);
      console.log('');
    }
  }

  console.log('═'.repeat(64));
  logger.info('Step 2 complete.');
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});

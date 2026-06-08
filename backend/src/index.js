const { loadAllPDFs } = require('./loaders/pdfLoader');
const logger = require('./utils/logger');

async function main() {
  logger.info('=== RAG Document Assistant — Step 1: PDF Loader ===');

  const documents = await loadAllPDFs();

  logger.info(`\n--- Results (${documents.length} document(s)) ---`);
  documents.forEach((doc, i) => {
    logger.info(`[${i + 1}] ${doc.fileName} — ${doc.content.length} chars`);
    // Print first 200 chars as a preview
    console.log(`\nPreview of "${doc.fileName}":\n${doc.content.slice(0, 200)}\n${'─'.repeat(60)}`);
  });
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

const { answerQuestion } = require('./rag/answerGenerator');
const logger             = require('./utils/logger');

const TEST_QUESTIONS = [
  'What is useState?',
  'How do I create an Express server?',
  'What is MongoDB aggregation?',
  'What is Angular?',
];

function printResult(question, result) {
  console.log('\n' + '═'.repeat(68));
  console.log(`  Q: "${question}"`);
  console.log('═'.repeat(68));

  console.log('\n  ANSWER:');
  // Word-wrap answer at 64 chars
  const words = result.answer.split(' ');
  let line = '    ';
  words.forEach((w) => {
    if ((line + w).length > 64) { console.log(line); line = '    ' + w + ' '; }
    else line += w + ' ';
  });
  if (line.trim()) console.log(line);

  console.log('\n  SOURCES:');
  if (result.sources.length === 0) {
    console.log('    (none)');
  } else {
    result.sources.forEach((s, i) => {
      console.log(`    [${i + 1}] ${s.source}  (chunk ${s.chunkIndex})`);
    });
  }

  console.log(`\n  Chunks used: ${result.chunksUsed}`);
}

async function main() {
  logger.info('=== RAG Document Assistant — Step 6: Answer Generation ===\n');

  for (const question of TEST_QUESTIONS) {
    try {
      const result = await answerQuestion(question);
      printResult(question, result);
    } catch (err) {
      logger.error(`Failed for "${question}": ${err.message}`);
    }
  }

  console.log('\n' + '═'.repeat(68));
  logger.info('Step 6 complete.');
}

main().catch((err) => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});

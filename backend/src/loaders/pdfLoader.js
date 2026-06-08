const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const logger = require('../utils/logger');
const { DOCS_DIR } = require('../config/paths');

/**
 * Reads a single PDF file and returns its parsed text content.
 * Falls back to plain-text reading if the file is not a binary PDF.
 * @param {string} filePath - Absolute path to the PDF file.
 * @returns {Promise<{fileName: string, content: string}>}
 */
async function parsePDF(filePath) {
  const fileName = path.basename(filePath);
  logger.info(`Parsing: ${fileName}`);

  const buffer = fs.readFileSync(filePath);

  // Check for PDF magic bytes (%PDF-)
  const isPDF = buffer.slice(0, 5).toString('ascii') === '%PDF-';

  let content;

  if (isPDF) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      content = result.text.trim();
    } finally {
      await parser.destroy();
    }
    logger.info(`Parsed binary PDF "${fileName}" — ${content.length} characters`);
  } else {
    // Plain-text file stored with a .pdf extension
    content = buffer.toString('utf-8').trim();
    logger.warn(`"${fileName}" is not a binary PDF — read as plain text (${content.length} characters)`);
  }

  return { fileName, content };
}

/**
 * Loads all PDF files from the /docs directory.
 * @returns {Promise<Array<{fileName: string, content: string}>>}
 */
async function loadAllPDFs() {
  logger.info(`Looking for PDFs in: ${DOCS_DIR}`);

  if (!fs.existsSync(DOCS_DIR)) {
    throw new Error(`Docs directory not found: ${DOCS_DIR}`);
  }

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.pdf'));

  if (files.length === 0) {
    logger.warn('No PDF files found in /docs directory');
    return [];
  }

  logger.info(`Found ${files.length} PDF file(s): ${files.join(', ')}`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file);
    try {
      const parsed = await parsePDF(filePath);
      results.push(parsed);
    } catch (err) {
      logger.error(`Failed to load "${file}": ${err.message}`);
    }
  }

  logger.info(`Successfully loaded ${results.length} of ${files.length} PDF(s)`);
  return results;
}

module.exports = { loadAllPDFs };

const { CHUNKER_CONFIG } = require('../config/chunkerConfig');
const logger = require('../utils/logger');

/**
 * Parent-Child Semantic Chunking
 *
 * Stage 1 — Parent chunks:
 *   Split on natural paragraph/section boundaries (\n\n, headings, blank lines).
 *   Parents are capped at parentMaxChars. They are NOT embedded — they exist only
 *   as rich context to feed the LLM once a child is retrieved.
 *
 * Stage 2 — Child chunks:
 *   Each parent is further split into small overlapping child chunks (~childMaxChars).
 *   Children are what get embedded and stored in ChromaDB. Each child carries the
 *   full parent text in its metadata so the retriever can return the wider context.
 *
 * Why this works better than fixed-size chunking:
 *   - Children are small enough to match a specific query with high precision.
 *   - The LLM receives the full parent section (not just the fragment), giving it
 *     enough context to produce a coherent, accurate answer.
 */

// Ordered list of separators tried in priority order (most structural → least).
const SEPARATORS = [
  /\n#{1,6}\s+/,   // markdown headings
  /\n{2,}/,        // blank lines / paragraph breaks
  /\n/,            // single newlines
  /(?<=\.\s)/,     // sentence ends
];

/**
 * Splits text on the first separator pattern that produces >1 piece.
 * Falls back to hard character splits if no separator matches.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
function semanticSplit(text, maxChars) {
  if (text.length <= maxChars) return [text];

  for (const sep of SEPARATORS) {
    const parts = text.split(sep).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      // Merge consecutive tiny parts back up to maxChars to avoid dust fragments.
      return mergeParts(parts, maxChars);
    }
  }

  // Last resort: hard split at word boundary near maxChars.
  return hardSplit(text, maxChars);
}

/**
 * Greedily merges consecutive parts into chunks no larger than maxChars.
 */
function mergeParts(parts, maxChars) {
  const merged = [];
  let current = '';

  for (const part of parts) {
    if (!current) {
      current = part;
    } else if ((current + '\n\n' + part).length <= maxChars) {
      current += '\n\n' + part;
    } else {
      merged.push(current);
      // If the part itself exceeds maxChars, recursively split it.
      if (part.length > maxChars) {
        merged.push(...hardSplit(part, maxChars));
        current = '';
      } else {
        current = part;
      }
    }
  }

  if (current) merged.push(current);
  return merged;
}

/**
 * Hard-splits text at word boundaries near maxChars.
 */
function hardSplit(text, maxChars) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start) end = boundary;
    } else {
      end = text.length;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    start = end;
  }
  return chunks;
}

/**
 * Splits a parent chunk into small overlapping child chunks.
 *
 * @param {string} parentText
 * @param {number} maxChars
 * @param {number} overlapChars
 * @returns {string[]}
 */
function splitIntoChildren(parentText, maxChars, overlapChars) {
  const children = [];
  const step = maxChars - overlapChars;
  let start = 0;

  while (start < parentText.length) {
    let end = start + maxChars;
    if (end >= parentText.length) {
      end = parentText.length;
    } else {
      const boundary = parentText.lastIndexOf(' ', end);
      if (boundary > start) end = boundary;
    }

    const child = parentText.slice(start, end).trim();
    if (child) children.push(child);
    if (end === parentText.length) break;
    // Guarantee forward progress: next start must be strictly greater than current start.
    // Without this, a word boundary that falls within the overlap window (e.g. the last
    // space before `start + maxChars` is at `start + overlapChars`) produces
    // `end - overlapChars === start`, causing an infinite loop.
    start = Math.max(end - overlapChars, start + 1);
  }

  return children;
}

/**
 * Produces parent-child chunks from a single document.
 *
 * Each returned chunk represents a child (small, embeddable unit) and carries:
 *   - id, source, chunkIndex  — same shape as before (compatible with existing pipeline)
 *   - parentId                — links back to the parent section
 *   - parentText              — full parent text, stored in Chroma metadata for LLM context
 *
 * @param {{ fileName: string, content: string }} document
 * @param {object} [options]
 * @returns {Array<{
 *   id: string, source: string, chunkIndex: number, text: string,
 *   parentId: string, parentText: string
 * }>}
 */
function chunkDocument(document, options = {}) {
  const { fileName, content } = document;
  const parentMaxChars  = options.parentMaxChars  ?? CHUNKER_CONFIG.parentMaxChars;
  const childMaxChars   = options.childMaxChars   ?? CHUNKER_CONFIG.childMaxChars;
  const childOverlap    = options.childOverlapChars ?? CHUNKER_CONFIG.childOverlapChars;

  if (!content || content.trim().length === 0) {
    logger.warn(`"${fileName}" has no content — skipping`);
    return [];
  }

  const text = content.trim();

  // Stage 1: semantic parent chunks
  const parents = semanticSplit(text, parentMaxChars);
  logger.info(`"${fileName}" → ${parents.length} parent section(s)`);

  const allChildren = [];
  let childIndex = 0;

  parents.forEach((parentText, pIdx) => {
    const parentId = `${fileName}::parent::${pIdx}`;

    // Stage 2: child chunks within each parent
    const childTexts = splitIntoChildren(parentText, childMaxChars, childOverlap);

    childTexts.forEach((childText) => {
      allChildren.push({
        id:         `${fileName}::chunk::${childIndex}`,
        source:     fileName,
        chunkIndex: childIndex,
        text:       childText,
        parentId,
        parentText,
      });
      childIndex++;
    });
  });

  logger.info(`"${fileName}" → ${allChildren.length} child chunk(s) across ${parents.length} parent(s)`);
  return allChildren;
}

/**
 * Chunks an array of documents.
 *
 * @param {Array<{fileName:string, content:string}>} documents
 * @param {object} [options]
 * @returns {Array}
 */
function chunkDocuments(documents, options = {}) {
  logger.info(`Chunking ${documents.length} document(s)...`);
  const allChunks = documents.flatMap((doc) => chunkDocument(doc, options));
  logger.info(`Total child chunks produced: ${allChunks.length}`);
  return allChunks;
}

module.exports = { chunkDocument, chunkDocuments };

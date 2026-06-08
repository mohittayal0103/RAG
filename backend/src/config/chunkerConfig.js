const CHUNKER_CONFIG = {
  // Parent chunks: large sections split on paragraph/heading boundaries
  parentMaxChars: 2000,

  // Child chunks: small units embedded and stored in Chroma
  childMaxChars: 400,
  childOverlapChars: 50,
};

module.exports = { CHUNKER_CONFIG };

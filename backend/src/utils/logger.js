const LOG_LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

const logger = {
  info:  (msg) => console.log(formatMessage(LOG_LEVELS.INFO, msg)),
  warn:  (msg) => console.warn(formatMessage(LOG_LEVELS.WARN, msg)),
  error: (msg) => console.error(formatMessage(LOG_LEVELS.ERROR, msg)),
};

module.exports = logger;

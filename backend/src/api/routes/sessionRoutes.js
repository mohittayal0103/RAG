/**
 * sessionRoutes.js
 *
 * Registers session-management endpoints under the /sessions prefix (app.js).
 *
 * Route table:
 *   POST /sessions                      → create a new session
 *   GET  /sessions                      → list all sessions
 *   GET  /sessions/:sessionId/messages  → message history for one session
 */

const rateLimit                     = require('express-rate-limit');
const { Router }                    = require('express');
const { create, list, getMessages, remove } = require('../controllers/sessionController');

// H-4: 10 session creations per minute per IP
const sessionCreateLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => res.status(429).json({
    success:   false,
    error:     'Too many session creation requests — try again later.',
    requestId: req.requestId,
  }),
});

const router = Router();

router.post('/',                        sessionCreateLimiter, create);
router.get('/',                         list);
router.get('/:sessionId/messages',      getMessages);
router.delete('/:sessionId',            remove);

module.exports = router;

/**
 * chatRoutes.js
 *
 * Registers chat endpoints under the /chat prefix (set in app.js).
 *
 *  POST /chat  → accepts { sessionId, question } and returns a RAG-generated answer
 */

const rateLimit  = require('express-rate-limit');
const { Router } = require('express');
const { chat }   = require('../controllers/chatController');

// H-04: 20 chat requests per minute per IP
const chatLimiter = rateLimit({
  windowMs:       60 * 1000,
  max:            20,
  standardHeaders: true,
  legacyHeaders:  false,
  handler: (req, res) => res.status(429).json({
    success:   false,
    error:     'Too many chat requests — try again later.',
    requestId: req.requestId,
  }),
});

const router = Router();

/** @type {import('express').RequestHandler} */
router.post('/', chatLimiter, chat);

module.exports = router;

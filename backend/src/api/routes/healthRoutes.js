/**
 * healthRoutes.js
 *
 * Registers health-check endpoints under the /health prefix (set in app.js).
 *
 *  GET /health        → liveness  (always 200, no I/O)
 *  GET /health/ready  → readiness (probes ChromaDB + env key)
 */

const { Router }                  = require('express');
const { getHealth, getReadiness } = require('../controllers/healthController');

const router = Router();

/** @type {import('express').RequestHandler} */
router.get('/',      getHealth);

/** @type {import('express').RequestHandler} */
router.get('/ready', getReadiness);

module.exports = router;

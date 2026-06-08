const { Router } = require('express');
const { listProviders } = require('../controllers/llmController');

const router = Router();

router.get('/providers', listProviders);

module.exports = router;

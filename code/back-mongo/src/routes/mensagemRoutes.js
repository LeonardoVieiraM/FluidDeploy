const express = require('express');
const router = express.Router();
const mensagemController = require('../controllers/mensagemController');
const { validateMessage } = require('../middlewares/validation');
const auth = require('../middlewares/auth');

// Send message
router.post('/', auth, validateMessage, mensagemController.enviar);

// Get conversation
router.get('/conversa/:otherUserId', auth, mensagemController.listarConversa);

// Mark as read
router.post('/conversa/:otherUserId/read', auth, mensagemController.marcarConversaComoLida);

// Count unread
router.get('/nao-lidas', auth, mensagemController.contarNaoLidas);

router.delete('/conversa/:otherUserId', auth, mensagemController.deletarConversa);

module.exports = router;
const express = require('express');
const router = express.Router();
const conversaController = require('../controllers/conversaController');
const auth = require('../middlewares/auth');

// List conversations
router.get('/', auth, conversaController.listar);

// Create or get a conversation with another user (get-or-create)
router.post('/', auth, conversaController.getOrCreate);

// Get messages by conversation id
router.get('/:conversationId/messages', auth, conversaController.getMessages);

// Mark conversation as read by conversation id
router.post('/:conversationId/read', auth, conversaController.markAsReadByConversation);

// Delete conversation for current user
router.delete('/:conversationId', auth, conversaController.deleteForUser);

// Update conversation config (keeps existing behavior mapped by otherUserId)
router.patch('/:otherUserId', auth, conversaController.atualizarConfig);

// Get default group image
router.get('/default-group-image', conversaController.getDefaultGroupImage);

// Atualizar imagem de perfil do grupo
router.patch('/group/:groupId/profile-image', auth, conversaController.updateGroupProfileImage);
router.get('/group/:groupId/profile-image', auth, conversaController.getGroupProfileImage);

module.exports = router;
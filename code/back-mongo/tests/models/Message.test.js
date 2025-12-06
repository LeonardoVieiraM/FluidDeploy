// IMPLEMENTAÇÃO FUTURA - Testes do modelo Message MongoDB
// PROBLEMA: Jest não consegue resolver módulos quando executado em lote
// STATUS: Não funciona - erro "Cannot find module '../src/models/Message'"
// SOLUÇÃO: Aguardar correção da configuração do Jest ou refatoração dos imports

/*
const Message = require('../src/models/Message');

describe('Modelo Message MongoDB', () => {
    describe('Criação de Mensagem', () => {
        test('deve criar uma mensagem válida', async () => {
            const messageData = {
                senderId: '507f1f77bcf86cd799439011',
                recipientId: '507f1f77bcf86cd799439012',
                originalText: 'Olá, como você está?',
                translatedText: 'Hello, how are you?',
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            };

            const message = await Message.create(messageData);

            expect(message).toBeDefined();
            expect(message.senderId.toString()).toBe(messageData.senderId);
            expect(message.recipientId.toString()).toBe(messageData.recipientId);
            expect(message.originalText).toBe('Olá, como você está?');
            expect(message.translatedText).toBe('Hello, how are you?');
            expect(message.sourceLang).toBe('pt-BR');
            expect(message.targetLang).toBe('en-US');
            expect(message.status).toBe('sent');
            expect(message.readBy).toEqual([]);
            expect(message.createdAt).toBeDefined();
            expect(message.updatedAt).toBeDefined();
            expect(message._id).toBeDefined();
        });

        test('deve criar mensagem com valores padrão', async () => {
            const messageData = {
                senderId: '507f1f77bcf86cd799439011',
                recipientId: '507f1f77bcf86cd799439012',
                originalText: 'Teste'
            };

            const message = await Message.create(messageData);

            expect(message.status).toBe('sent');
            expect(message.readBy).toEqual([]);
            expect(message.translatedText).toBeUndefined();
            expect(message.sourceLang).toBeUndefined();
            expect(message.targetLang).toBeUndefined();
        });
    });

    describe('Busca de Conversas', () => {
        let senderId, recipientId, messageId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            const messageData = {
                senderId,
                recipientId,
                originalText: 'Primeira mensagem',
                translatedText: 'First message',
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            };

            const message = await Message.create(messageData);
            messageId = message._id;
        });

        test('deve encontrar conversa entre dois usuários', async () => {
            const messages = await Message.findConversation(senderId, recipientId);
            
            expect(messages).toHaveLength(1);
            expect(messages[0].senderId.toString()).toBe(senderId);
            expect(messages[0].recipientId.toString()).toBe(recipientId);
            expect(messages[0].originalText).toBe('Primeira mensagem');
        });

        test('deve encontrar conversa bidirecional', async () => {
            // Criar mensagem na direção oposta
            await Message.create({
                senderId: recipientId,
                recipientId: senderId,
                originalText: 'Resposta',
                translatedText: 'Reply'
            });

            const messages = await Message.findConversation(senderId, recipientId);
            
            expect(messages).toHaveLength(2);
        });

        test('deve encontrar todas as conversas de um usuário', async () => {
            const messages = await Message.findConversation(senderId);
            
            expect(messages).toHaveLength(1);
            expect(messages[0].senderId.toString()).toBe(senderId);
        });

        test('deve ordenar mensagens por data decrescente', async () => {
            // Criar segunda mensagem
            await Message.create({
                senderId,
                recipientId,
                originalText: 'Segunda mensagem'
            });

            const messages = await Message.findConversation(senderId, recipientId);
            
            expect(messages).toHaveLength(2);
            expect(messages[0].originalText).toBe('Segunda mensagem');
            expect(messages[1].originalText).toBe('Primeira mensagem');
        });

        test('deve aplicar limite e offset', async () => {
            // Criar mais mensagens
            for (let i = 2; i <= 5; i++) {
                await Message.create({
                    senderId,
                    recipientId,
                    originalText: `Mensagem ${i}`
                });
            }

            const messages = await Message.findConversation(senderId, recipientId, 2, 1);
            
            expect(messages).toHaveLength(2);
            expect(messages[0].originalText).toBe('Mensagem 4');
            expect(messages[1].originalText).toBe('Mensagem 3');
        });
    });

    describe('Status de Mensagens', () => {
        let senderId, recipientId, messageId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            const messageData = {
                senderId,
                recipientId,
                originalText: 'Mensagem de teste'
            };

            const message = await Message.create(messageData);
            messageId = message._id;
        });

        test('deve marcar mensagens como entregues', async () => {
            const result = await Message.markAsDelivered(recipientId, senderId);
            
            expect(result.modifiedCount).toBe(1);
            
            const message = await Message.findById(messageId);
            expect(message.status).toBe('delivered');
        });

        test('deve marcar mensagens como lidas', async () => {
            // Primeiro marcar como entregue
            await Message.markAsDelivered(recipientId, senderId);
            
            const result = await Message.markAsRead(recipientId, senderId);
            
            expect(result.modifiedCount).toBe(1);
            
            const message = await Message.findById(messageId);
            expect(message.status).toBe('read');
            expect(message.readBy.map(id => id.toString())).toContain(recipientId);
        });

        test('deve marcar mensagens como lidas até mensagem específica', async () => {
            // Criar segunda mensagem
            const secondMessage = await Message.create({
                senderId,
                recipientId,
                originalText: 'Segunda mensagem'
            });

            await Message.markAsDelivered(recipientId, senderId);
            
            const result = await Message.markAsRead(recipientId, senderId, messageId);
            
            expect(result.modifiedCount).toBe(1);
            
            const firstMessage = await Message.findById(messageId);
            expect(firstMessage.status).toBe('read');
            
            const secondMessageUpdated = await Message.findById(secondMessage._id);
            expect(secondMessageUpdated.status).toBe('delivered');
        });

        test('deve atualizar status de mensagem específica', async () => {
            const result = await Message.updateStatus(messageId, 'delivered');
            
            expect(result.modifiedCount).toBe(1);
            
            const message = await Message.findById(messageId);
            expect(message.status).toBe('delivered');
        });
    });

    describe('Contagem de Mensagens Não Lidas', () => {
        let senderId, recipientId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            // Criar várias mensagens com diferentes status
            await Message.create({
                senderId,
                recipientId,
                originalText: 'Mensagem 1',
                status: 'sent'
            });

            await Message.create({
                senderId,
                recipientId,
                originalText: 'Mensagem 2',
                status: 'delivered'
            });

            await Message.create({
                senderId,
                recipientId,
                originalText: 'Mensagem 3',
                status: 'read'
            });
        });

        test('deve contar mensagens não lidas por conversa', async () => {
            const unreadCounts = await Message.countUnreadByConversation(recipientId);
            
            expect(unreadCounts).toHaveLength(1);
            expect(unreadCounts[0].otherUserId).toBe(senderId);
            expect(unreadCounts[0].count).toBe(2); // sent + delivered
        });

        test('deve retornar array vazio quando não há mensagens não lidas', async () => {
            // Marcar todas como lidas
            await Message.markAsRead(recipientId, senderId);
            
            const unreadCounts = await Message.countUnreadByConversation(recipientId);
            
            expect(unreadCounts).toHaveLength(0);
        });
    });

    describe('Busca de Mensagens', () => {
        let messageId;

        beforeEach(async () => {
            const messageData = {
                senderId: '507f1f77bcf86cd799439011',
                recipientId: '507f1f77bcf86cd799439012',
                originalText: 'Mensagem para busca'
            };

            const message = await Message.create(messageData);
            messageId = message._id;
        });

        test('deve encontrar mensagem por ID', async () => {
            const message = await Message.findById(messageId);
            
            expect(message).toBeDefined();
            expect(message._id.toString()).toBe(messageId.toString());
            expect(message.originalText).toBe('Mensagem para busca');
        });

        test('deve retornar null para mensagem inexistente', async () => {
            const fakeId = '507f1f77bcf86cd799439999';
            const message = await Message.findById(fakeId);
            
            expect(message).toBeNull();
        });
    });

    describe('Última Mensagem Entre Usuários', () => {
        let senderId, recipientId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            // Criar várias mensagens
            await Message.create({
                senderId,
                recipientId,
                originalText: 'Primeira mensagem'
            });

            await Message.create({
                senderId: recipientId,
                recipientId: senderId,
                originalText: 'Segunda mensagem'
            });

            await Message.create({
                senderId,
                recipientId,
                originalText: 'Terceira mensagem'
            });
        });

        test('deve obter última mensagem entre usuários', async () => {
            const lastMessage = await Message.getLastMessageBetweenUsers(senderId, recipientId);
            
            expect(lastMessage).toBeDefined();
            expect(lastMessage.originalText).toBe('Terceira mensagem');
        });

        test('deve considerar mensagens bidirecionais', async () => {
            // Criar mensagem na direção oposta
            await Message.create({
                senderId: recipientId,
                recipientId: senderId,
                originalText: 'Última mensagem'
            });

            const lastMessage = await Message.getLastMessageBetweenUsers(senderId, recipientId);
            
            expect(lastMessage.originalText).toBe('Última mensagem');
        });

        test('deve retornar null quando não há mensagens', async () => {
            const fakeSenderId = '507f1f77bcf86cd799439999';
            const lastMessage = await Message.getLastMessageBetweenUsers(fakeSenderId, recipientId);
            
            expect(lastMessage).toBeNull();
        });
    });
});
*/

// Ensure Message model is available for active tests
const Message = require('../../src/models/Message');

describe('Modelo Message MongoDB', () => {
    describe('Criação de Mensagem', () => {
        test('deve criar uma mensagem válida', async () => {
            const messageData = {
                senderId: '507f1f77bcf86cd799439011',
                recipientId: '507f1f77bcf86cd799439012',
                originalText: 'Olá, como você está?',
                translatedText: 'Hello, how are you?',
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            };

            const message = await Message.create(messageData);

            expect(message).toBeDefined();
            expect(message.senderId.toString()).toBe(messageData.senderId);
            expect(message.recipientId.toString()).toBe(messageData.recipientId);
            expect(message.originalText).toBe('Olá, como você está?');
            expect(message.translatedText).toBe('Hello, how are you?');
            expect(message.sourceLang).toBe('pt-BR');
            expect(message.targetLang).toBe('en-US');
            expect(message.status).toBe('sent');
            expect(message.readBy).toEqual([]);
            expect(message.createdAt).toBeDefined();
            expect(message.updatedAt).toBeDefined();
            expect(message._id).toBeDefined();
        });

        test('deve criar mensagem com valores padrão', async () => {
            const messageData = {
                senderId: '507f1f77bcf86cd799439011',
                recipientId: '507f1f77bcf86cd799439012',
                originalText: 'Teste'
            };

            const message = await Message.create(messageData);

            expect(message.status).toBe('sent');
            expect(message.readBy).toEqual([]);
            expect(message.translatedText).toBeUndefined();
            expect(message.sourceLang).toBeUndefined();
            expect(message.targetLang).toBeUndefined();
        });
    });

    describe('Busca de Conversas', () => {
        let senderId, recipientId, messageId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            const messageData = {
                senderId,
                recipientId,
                originalText: 'Primeira mensagem',
                translatedText: 'First message',
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            };

            const message = await Message.create(messageData);
            messageId = message._id;
        });

        test('deve encontrar conversa entre dois usuários', async () => {
            const messages = await Message.findConversation(senderId, recipientId);
            
            expect(messages).toHaveLength(1);
            expect(messages[0].senderId.toString()).toBe(senderId);
            expect(messages[0].recipientId.toString()).toBe(recipientId);
            expect(messages[0].originalText).toBe('Primeira mensagem');
        });

        test('deve encontrar conversa bidirecional', async () => {
            // Criar mensagem na direção oposta
            await Message.create({
                senderId: recipientId,
                recipientId: senderId,
                originalText: 'Resposta',
                translatedText: 'Reply'
            });

            const messages = await Message.findConversation(senderId, recipientId);
            
            expect(messages).toHaveLength(2);
        });

        test('deve encontrar todas as conversas de um usuário', async () => {
            const messages = await Message.findConversation(senderId);
            
            expect(messages).toHaveLength(1);
            expect(messages[0].senderId.toString()).toBe(senderId);
        });

        test('deve ordenar mensagens por data decrescente', async () => {
            // Criar segunda mensagem
            await Message.create({
                senderId,
                recipientId,
                originalText: 'Segunda mensagem'
            });

            const messages = await Message.findConversation(senderId, recipientId);
            
            expect(messages).toHaveLength(2);
            expect(messages[0].originalText).toBe('Segunda mensagem');
            expect(messages[1].originalText).toBe('Primeira mensagem');
        });

        test('deve aplicar limite e offset', async () => {
            // Criar mais mensagens
            for (let i = 2; i <= 5; i++) {
                await Message.create({
                    senderId,
                    recipientId,
                    originalText: `Mensagem ${i}`
                });
            }

            const messages = await Message.findConversation(senderId, recipientId, 2, 1);
            
            expect(messages).toHaveLength(2);
            expect(messages[0].originalText).toBe('Mensagem 4');
            expect(messages[1].originalText).toBe('Mensagem 3');
        });
    });

    describe('Status de Mensagens', () => {
        let senderId, recipientId, messageId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            const messageData = {
                senderId,
                recipientId,
                originalText: 'Mensagem de teste'
            };

            const message = await Message.create(messageData);
            messageId = message._id;
        });

        test('deve marcar mensagens como entregues', async () => {
            const result = await Message.markAsDelivered(recipientId, senderId);
            
            expect(result.modifiedCount).toBe(1);
            
            const message = await Message.findById(messageId);
            expect(message.status).toBe('delivered');
        });

        test('deve marcar mensagens como lidas', async () => {
            // Primeiro marcar como entregue
            await Message.markAsDelivered(recipientId, senderId);
            
            const result = await Message.markAsRead(recipientId, senderId);
            
            expect(result.modifiedCount).toBe(1);
            
            const message = await Message.findById(messageId);
            expect(message.status).toBe('read');
            expect(message.readBy.map(id => id.toString())).toContain(recipientId);
        });

        test('deve marcar mensagens como lidas até mensagem específica', async () => {
            // Criar segunda mensagem
            const secondMessage = await Message.create({
                senderId,
                recipientId,
                originalText: 'Segunda mensagem'
            });

            await Message.markAsDelivered(recipientId, senderId);
            
            const result = await Message.markAsRead(recipientId, senderId, messageId);
            
            expect(result.modifiedCount).toBe(1);
            
            const firstMessage = await Message.findById(messageId);
            expect(firstMessage.status).toBe('read');
            
            const secondMessageUpdated = await Message.findById(secondMessage._id);
            expect(secondMessageUpdated.status).toBe('delivered');
        });

        test('deve atualizar status de mensagem específica', async () => {
            const result = await Message.updateStatus(messageId, 'delivered');
            
            expect(result.modifiedCount).toBe(1);
            
            const message = await Message.findById(messageId);
            expect(message.status).toBe('delivered');
        });
    });

    describe('Contagem de Mensagens Não Lidas', () => {
        let senderId, recipientId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            // Criar várias mensagens com diferentes status
            await Message.create({
                senderId,
                recipientId,
                originalText: 'Mensagem 1',
                status: 'sent'
            });

            await Message.create({
                senderId,
                recipientId,
                originalText: 'Mensagem 2',
                status: 'delivered'
            });

            await Message.create({
                senderId,
                recipientId,
                originalText: 'Mensagem 3',
                status: 'read'
            });
        });

        test('deve contar mensagens não lidas por conversa', async () => {
            const unreadCounts = await Message.countUnreadByConversation(recipientId);
            
            expect(unreadCounts).toHaveLength(1);
            expect(unreadCounts[0].otherUserId).toBe(senderId);
            expect(unreadCounts[0].count).toBe(2); // sent + delivered
        });

        test('deve retornar array vazio quando não há mensagens não lidas', async () => {
            // Marcar todas como lidas
            await Message.markAsRead(recipientId, senderId);
            
            const unreadCounts = await Message.countUnreadByConversation(recipientId);
            
            expect(unreadCounts).toHaveLength(0);
        });
    });

    describe('Busca de Mensagens', () => {
        let messageId;

        beforeEach(async () => {
            const messageData = {
                senderId: '507f1f77bcf86cd799439011',
                recipientId: '507f1f77bcf86cd799439012',
                originalText: 'Mensagem para busca'
            };

            const message = await Message.create(messageData);
            messageId = message._id;
        });

        test('deve encontrar mensagem por ID', async () => {
            const message = await Message.findById(messageId);
            
            expect(message).toBeDefined();
            expect(message._id.toString()).toBe(messageId.toString());
            expect(message.originalText).toBe('Mensagem para busca');
        });

        test('deve retornar null para mensagem inexistente', async () => {
            const fakeId = '507f1f77bcf86cd799439999';
            const message = await Message.findById(fakeId);
            
            expect(message).toBeNull();
        });
    });

    describe('Última Mensagem Entre Usuários', () => {
        let senderId, recipientId;

        beforeEach(async () => {
            senderId = '507f1f77bcf86cd799439011';
            recipientId = '507f1f77bcf86cd799439012';

            // Criar várias mensagens
            await Message.create({
                senderId,
                recipientId,
                originalText: 'Primeira mensagem'
            });

            await Message.create({
                senderId: recipientId,
                recipientId: senderId,
                originalText: 'Segunda mensagem'
            });

            await Message.create({
                senderId,
                recipientId,
                originalText: 'Terceira mensagem'
            });
        });

        test('deve obter última mensagem entre usuários', async () => {
            const lastMessage = await Message.getLastMessageBetweenUsers(senderId, recipientId);
            
            expect(lastMessage).toBeDefined();
            expect(lastMessage.originalText).toBe('Terceira mensagem');
        });

        test('deve considerar mensagens bidirecionais', async () => {
            // Criar mensagem na direção oposta
            await Message.create({
                senderId: recipientId,
                recipientId: senderId,
                originalText: 'Última mensagem'
            });

            const lastMessage = await Message.getLastMessageBetweenUsers(senderId, recipientId);
            
            expect(lastMessage.originalText).toBe('Última mensagem');
        });

        test('deve retornar null quando não há mensagens', async () => {
            const fakeSenderId = '507f1f77bcf86cd799439999';
            const lastMessage = await Message.getLastMessageBetweenUsers(fakeSenderId, recipientId);
            
            expect(lastMessage).toBeNull();
        });
    });
});

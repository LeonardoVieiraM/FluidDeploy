// Teste simples para verificar importação dos modelos MongoDB
describe('Importação de Modelos MongoDB', () => {
    test('deve importar modelo User', () => {
        const User = require('../src/models/User');
        expect(User).toBeDefined();
        expect(typeof User.create).toBe('function');
        expect(typeof User.findByEmail).toBe('function');
    });

    test('deve importar modelo Message', () => {
        const Message = require('../src/models/Message');
        expect(Message).toBeDefined();
        expect(typeof Message.create).toBe('function');
        expect(typeof Message.findConversation).toBe('function');
    });

    test('deve importar UsuarioService', () => {
        const UsuarioService = require('../src/services/usuarioService');
        expect(UsuarioService).toBeDefined();
        expect(typeof UsuarioService.cadastrar).toBe('function');
        expect(typeof UsuarioService.login).toBe('function');
    });

    test('deve importar TranslationService', () => {
        const TranslationService = require('../src/services/translationService');
        expect(TranslationService).toBeDefined();
        expect(typeof TranslationService.safeTranslate).toBe('function');
        expect(typeof TranslationService.isSupported).toBe('function');
    });
});

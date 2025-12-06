// IMPLEMENTAÇÃO FUTURA - Testes do TranslationService MongoDB
// PROBLEMA: Jest não consegue resolver módulos quando executado em lote
// STATUS: Não funciona - erro "Cannot find module '../src/services/translationService'"
// SOLUÇÃO: Aguardar correção da configuração do Jest ou refatoração dos imports
// NOTA: Este teste usa mocks do fetch para simular requisições HTTP (necessário)


// Bring in service and provide a fetch mock for the tests below
const TranslationService = require('../../src/services/translationService');
const { IDIOMAS_SUPORTADOS } = require('../../constants');
global.fetch = jest.fn();

/*
const TranslationService = require('../src/services/translationService');
const { IDIOMAS_SUPORTADOS } = require('../../constants');

// Mock do fetch para testes
global.fetch = jest.fn();

describe('TranslationService MongoDB', () => {
    beforeEach(() => {
        fetch.mockClear();
        process.env.USE_TRANSLATION = 'true';
        process.env.LIBRETRANSLATE_URL = 'http://localhost:5000';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Validação de Idiomas', () => {
        test('deve validar idiomas suportados', () => {
            expect(TranslationService.isSupported('pt-BR')).toBe(true);
            expect(TranslationService.isSupported('en-US')).toBe(true);
            expect(TranslationService.isSupported('es-ES')).toBe(true);
            expect(TranslationService.isSupported('fr-FR')).toBe(true);
        });

        test('deve rejeitar idiomas não suportados', () => {
            expect(TranslationService.isSupported('ko-KR')).toBe(false);
            expect(TranslationService.isSupported('invalid-lang')).toBe(false);
        });

        test('deve mapear idiomas para formato LibreTranslate', () => {
            expect(TranslationService.mapToLibreLanguage('pt-BR')).toBe('pt');
            expect(TranslationService.mapToLibreLanguage('en-US')).toBe('en');
            expect(TranslationService.mapToLibreLanguage('es-ES')).toBe('es');
            expect(TranslationService.mapToLibreLanguage('fr-FR')).toBe('fr');
        });

        test('deve usar fallback para idiomas não mapeados', () => {
            expect(TranslationService.mapToLibreLanguage('unknown-lang')).toBe('unknown');
        });
    });

    describe('Tradução de Texto', () => {
        test('deve traduzir texto com sucesso', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, how are you?',
                    detectedLanguage: { language: 'pt' }
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, como você está?', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, how are you?');
            expect(resultado.detectedSourceLang).toBe('pt-BR');
            expect(resultado.provider).toBe('libretranslate');
            expect(resultado.translated).toBe(true);
            expect(resultado.error).toBeUndefined();
        });

        test('deve retornar texto original quando tradução está desabilitada', async () => {
            process.env.USE_TRANSLATION = 'false';

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('disabled');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve retornar texto original quando idiomas são iguais', async () => {
            const resultado = await TranslationService.safeTranslate('Hello, world!', {
                sourceLang: 'en-US',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, world!');
            expect(resultado.provider).toBe('same_language');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve retornar texto original quando não há texto', async () => {
            const resultado = await TranslationService.safeTranslate('', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('');
            expect(resultado.provider).toBe('none');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve retornar texto original quando não há idioma de destino', async () => {
            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('none');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve tratar texto não-string', async () => {
            const resultado = await TranslationService.safeTranslate(null, {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('');
            expect(resultado.provider).toBe('none');
            expect(resultado.translated).toBe(false);
        });

        test('deve fazer fallback quando tradução falha', async () => {
            fetch.mockRejectedValue(new Error('Network error'));

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('fallback');
            expect(resultado.translated).toBe(false);
            expect(resultado.error).toBe('Network error');
        });

        test('deve fazer fallback quando resposta HTTP não é OK', async () => {
            const mockResponse = {
                ok: false,
                status: 500
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('fallback');
            expect(resultado.translated).toBe(false);
            expect(resultado.error).toContain('HTTP error! status: 500');
        });

        test('deve fazer fallback quando resposta não contém texto traduzido', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    // Sem translatedText
                    detectedLanguage: { language: 'pt' }
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('fallback');
            expect(resultado.translated).toBe(false);
            expect(resultado.error).toBe('No translation received');
        });

        test('deve usar timeout na requisição', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, world!'
                })
            };
            fetch.mockResolvedValue(mockResponse);

            await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:5000/translate',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        q: 'Olá, mundo!',
                        source: 'pt',
                        target: 'en',
                        format: 'text'
                    }),
                    signal: expect.any(AbortSignal)
                })
            );
        });

        test('deve usar detecção automática de idioma quando sourceLang não especificado', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, world!',
                    detectedLanguage: { language: 'pt' }
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, world!');
            expect(resultado.detectedSourceLang).toBe('pt');
        });
    });

    describe('Idiomas Suportados', () => {
        test('deve obter lista de idiomas suportados do servidor', async () => {
            const mockResponse = {
                json: jest.fn().mockResolvedValue([
                    { code: 'pt', name: 'Portuguese' },
                    { code: 'en', name: 'English' },
                    { code: 'es', name: 'Spanish' }
                ])
            };
            fetch.mockResolvedValue(mockResponse);

            const idiomas = await TranslationService.getSupportedLanguages();

            expect(idiomas).toHaveLength(3);
            expect(idiomas[0]).toEqual({ code: 'pt', name: 'Portuguese' });
            expect(idiomas[1]).toEqual({ code: 'en', name: 'English' });
            expect(idiomas[2]).toEqual({ code: 'es', name: 'Spanish' });
        });

        test('deve usar fallback quando servidor não responde', async () => {
            fetch.mockRejectedValue(new Error('Server error'));

            const idiomas = await TranslationService.getSupportedLanguages();

            expect(idiomas).toBeDefined();
            expect(Array.isArray(idiomas)).toBe(true);
            expect(idiomas.length).toBeGreaterThan(0);
            
            // Deve conter os idiomas mapeados
            const codes = idiomas.map(lang => lang.code);
            expect(codes).toContain('pt-BR');
            expect(codes).toContain('en-US');
        });

        test('deve obter nome do idioma', () => {
            expect(TranslationService.getLanguageName('pt-BR')).toBe('Portuguese (Brazil)');
            expect(TranslationService.getLanguageName('en-US')).toBe('English (US)');
            expect(TranslationService.getLanguageName('es-ES')).toBe('Spanish');
            expect(TranslationService.getLanguageName('fr-FR')).toBe('French');
            expect(TranslationService.getLanguageName('unknown-lang')).toBe('unknown-lang');
        });
    });

    describe('Método translate', () => {
        test('deve chamar safeTranslate', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, world!'
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.translate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, world!');
            expect(resultado.provider).toBe('libretranslate');
        });
    });
});
*/

describe('TranslationService MongoDB', () => {
    beforeEach(() => {
        fetch.mockClear();
        process.env.USE_TRANSLATION = 'true';
        process.env.LIBRETRANSLATE_URL = 'http://localhost:5000';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Validação de Idiomas', () => {
        test('deve validar idiomas suportados', () => {
            expect(TranslationService.isSupported('pt-BR')).toBe(true);
            expect(TranslationService.isSupported('en-US')).toBe(true);
            expect(TranslationService.isSupported('es-ES')).toBe(true);
            expect(TranslationService.isSupported('fr-FR')).toBe(true);
        });

        test('deve rejeitar idiomas não suportados', () => {
            expect(TranslationService.isSupported('ko-KR')).toBe(false);
            expect(TranslationService.isSupported('invalid-lang')).toBe(false);
        });

        test('deve mapear idiomas para formato LibreTranslate', () => {
            expect(TranslationService.mapToLibreLanguage('pt-BR')).toBe('pt');
            expect(TranslationService.mapToLibreLanguage('en-US')).toBe('en');
            expect(TranslationService.mapToLibreLanguage('es-ES')).toBe('es');
            expect(TranslationService.mapToLibreLanguage('fr-FR')).toBe('fr');
        });

        test('deve usar fallback para idiomas não mapeados', () => {
            expect(TranslationService.mapToLibreLanguage('unknown-lang')).toBe('unknown');
        });
    });

    describe('Tradução de Texto', () => {
        test('deve traduzir texto com sucesso', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, how are you?',
                    detectedLanguage: { language: 'pt' }
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, como você está?', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, how are you?');
            expect(resultado.detectedSourceLang).toBe('pt-BR');
            expect(resultado.provider).toBe('libretranslate');
            expect(resultado.translated).toBe(true);
            expect(resultado.error).toBeUndefined();
        });

        test('deve retornar texto original quando tradução está desabilitada', async () => {
            process.env.USE_TRANSLATION = 'false';

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('disabled');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve retornar texto original quando idiomas são iguais', async () => {
            const resultado = await TranslationService.safeTranslate('Hello, world!', {
                sourceLang: 'en-US',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, world!');
            expect(resultado.provider).toBe('same_language');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve retornar texto original quando não há texto', async () => {
            const resultado = await TranslationService.safeTranslate('', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('');
            expect(resultado.provider).toBe('none');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve retornar texto original quando não há idioma de destino', async () => {
            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('none');
            expect(resultado.translated).toBe(false);
            expect(fetch).not.toHaveBeenCalled();
        });

        test('deve tratar texto não-string', async () => {
            const resultado = await TranslationService.safeTranslate(null, {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('');
            expect(resultado.provider).toBe('none');
            expect(resultado.translated).toBe(false);
        });

        test('deve fazer fallback quando tradução falha', async () => {
            fetch.mockRejectedValue(new Error('Network error'));

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('fallback');
            expect(resultado.translated).toBe(false);
            expect(resultado.error).toBe('Network error');
        });

        test('deve fazer fallback quando resposta HTTP não é OK', async () => {
            const mockResponse = {
                ok: false,
                status: 500
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('fallback');
            expect(resultado.translated).toBe(false);
            expect(resultado.error).toContain('HTTP error! status: 500');
        });

        test('deve fazer fallback quando resposta não contém texto traduzido', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    // Sem translatedText
                    detectedLanguage: { language: 'pt' }
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Olá, mundo!');
            expect(resultado.provider).toBe('fallback');
            expect(resultado.translated).toBe(false);
            expect(resultado.error).toBe('No translation received');
        });

        test('deve usar timeout na requisição', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, world!'
                })
            };
            fetch.mockResolvedValue(mockResponse);

            await TranslationService.safeTranslate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:5000/translate',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        q: 'Olá, mundo!',
                        source: 'pt',
                        target: 'en',
                        format: 'text'
                    }),
                    signal: expect.any(AbortSignal)
                })
            );
        });

        test('deve usar detecção automática de idioma quando sourceLang não especificado', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, world!',
                    detectedLanguage: { language: 'pt' }
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.safeTranslate('Olá, mundo!', {
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, world!');
            expect(resultado.detectedSourceLang).toBe('pt');
        });
    });

    describe('Idiomas Suportados', () => {
        test('deve obter lista de idiomas suportados do servidor', async () => {
            const mockResponse = {
                json: jest.fn().mockResolvedValue([
                    { code: 'pt', name: 'Portuguese' },
                    { code: 'en', name: 'English' },
                    { code: 'es', name: 'Spanish' }
                ])
            };
            fetch.mockResolvedValue(mockResponse);

            const idiomas = await TranslationService.getSupportedLanguages();

            expect(idiomas).toHaveLength(3);
            expect(idiomas[0]).toEqual({ code: 'pt', name: 'Portuguese' });
            expect(idiomas[1]).toEqual({ code: 'en', name: 'English' });
            expect(idiomas[2]).toEqual({ code: 'es', name: 'Spanish' });
        });

        test('deve usar fallback quando servidor não responde', async () => {
            fetch.mockRejectedValue(new Error('Server error'));

            const idiomas = await TranslationService.getSupportedLanguages();

            expect(idiomas).toBeDefined();
            expect(Array.isArray(idiomas)).toBe(true);
            expect(idiomas.length).toBeGreaterThan(0);
            
            // Deve conter os idiomas mapeados
            const codes = idiomas.map(lang => lang.code);
            expect(codes).toContain('pt-BR');
            expect(codes).toContain('en-US');
        });

        test('deve obter nome do idioma', () => {
            expect(TranslationService.getLanguageName('pt-BR')).toBe('Portuguese (Brazil)');
            expect(TranslationService.getLanguageName('en-US')).toBe('English (US)');
            expect(TranslationService.getLanguageName('es-ES')).toBe('Spanish');
            expect(TranslationService.getLanguageName('fr-FR')).toBe('French');
            expect(TranslationService.getLanguageName('unknown-lang')).toBe('unknown-lang');
        });
    });

    describe('Método translate', () => {
        test('deve chamar safeTranslate', async () => {
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    translatedText: 'Hello, world!'
                })
            };
            fetch.mockResolvedValue(mockResponse);

            const resultado = await TranslationService.translate('Olá, mundo!', {
                sourceLang: 'pt-BR',
                targetLang: 'en-US'
            });

            expect(resultado.translatedText).toBe('Hello, world!');
            expect(resultado.provider).toBe('libretranslate');
        });
    });
});

// Teste simples para verificar se a configuração MongoDB está funcionando
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Testes Básicos MongoDB', () => {
    test('bcrypt deve funcionar corretamente', async () => {
        const senha = 'senha123';
        const hash = await bcrypt.hash(senha, 10);
        
        expect(hash).toBeDefined();
        expect(hash).not.toBe(senha);
        
        const isValid = await bcrypt.compare(senha, hash);
        expect(isValid).toBe(true);
        
        const isInvalid = await bcrypt.compare('senhaerrada', hash);
        expect(isInvalid).toBe(false);
    });

    test('JWT deve funcionar corretamente', () => {
        const payload = { userId: 123 };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.userId).toBe(123);
    });

    test('Middleware auth básico', () => {
        const auth = require('../src/middlewares/auth');
        
        const req = {
            header: jest.fn()
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        // Teste sem token
        req.header.mockReturnValue(undefined);
        auth(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Acesso negado. Token não fornecido.'
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('Controller básico deve existir', () => {
        const usuarioController = require('../src/controllers/usuarioController');
        
        expect(usuarioController).toBeDefined();
        expect(typeof usuarioController.cadastrar).toBe('function');
        expect(typeof usuarioController.login).toBe('function');
        expect(typeof usuarioController.alterarStatus).toBe('function');
        expect(typeof usuarioController.alterarIdioma).toBe('function');
    });

    test('Service básico deve existir', () => {
        const usuarioService = require('../src/services/usuarioService');
        
        expect(usuarioService).toBeDefined();
        expect(typeof usuarioService.cadastrar).toBe('function');
        expect(typeof usuarioService.login).toBe('function');
        expect(typeof usuarioService.alterarStatus).toBe('function');
        expect(typeof usuarioService.alterarIdioma).toBe('function');
    });

    test('Constantes devem estar definidas', () => {
        const { STATUS, IDIOMAS_SUPORTADOS } = require('../constants');
        
        expect(STATUS).toBeDefined();
        expect(STATUS.ONLINE).toBe('online');
        expect(STATUS.OFFLINE).toBe('offline');
        expect(STATUS.OCUPADO).toBe('ocupado');
        
        expect(IDIOMAS_SUPORTADOS).toBeDefined();
        expect(Array.isArray(IDIOMAS_SUPORTADOS)).toBe(true);
        expect(IDIOMAS_SUPORTADOS).toContain('pt-BR');
        expect(IDIOMAS_SUPORTADOS).toContain('en-US');
    });

    test('MongoDB deve estar configurado', async () => {
        const mongodb = require('../src/config/database-mongodb');
        
        expect(mongodb).toBeDefined();
        expect(typeof mongodb.connect).toBe('function');
        expect(typeof mongodb.getObjectId).toBe('function');
        expect(typeof mongodb.isValidObjectId).toBe('function');
        
        // Testar conexão
        const db = await mongodb.connect();
        expect(db).toBeDefined();
        
        // Testar health check
        const health = await mongodb.healthCheck();
        expect(health.status).toBe('OK');
    });
});

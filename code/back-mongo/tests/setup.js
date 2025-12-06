// Configuração global para testes MongoDB
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.MONGODB_URI = 'mongodb://localhost:27017';
process.env.DB_NAME = 'chat_app_test';

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mockMongoUri;

// Configuração global para testes
beforeAll(async () => {
    try {
        // Iniciar MongoDB Memory Server
        mongoServer = await MongoMemoryServer.create({
            instance: {
                dbName: 'chat_app_test'
            }
        });
        
        mockMongoUri = mongoServer.getUri();
        
        // Configurar variáveis de ambiente para o mock
        process.env.MONGODB_URI = mockMongoUri;
        process.env.DB_NAME = 'chat_app_test';
        
    } catch (error) {
        console.error('Erro ao configurar testes:', error);
        throw error;
    }
});

afterAll(async () => {
    try {
        // Parar MongoDB Memory Server
        if (mongoServer) {
            await mongoServer.stop();
        }
    } catch (error) {
        console.error('Erro ao limpar testes:', error);
    }
});

beforeEach(async () => {
    try {
        // Limpar dados antes de cada teste
        const mongodb = require('../src/config/database-mongodb');
        const db = await mongodb.connect();
        const collections = await db.listCollections().toArray();
        
        for (const collection of collections) {
            await db.collection(collection.name).deleteMany({});
        }
    } catch (error) {
        // Ignorar erros de limpeza
        console.warn('Aviso: Erro ao limpar dados:', error.message);
    }
});

module.exports = { mockMongoUri };

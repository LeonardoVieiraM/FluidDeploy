require('dotenv').config();
const app = require('./src/app');
const http = require('http');

const websocketService = require('./src/services/websocketService');
const rabbitmqService = require('./src/services/rabbitmqService');
const mongodb = require('./src/config/database-mongodb');

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

async function initializeServices() {
    try {
        console.log('Inicializando serviços...');
        
        await mongodb.connect();
        console.log('MongoDB conectado');
        
        websocketService.initialize(server);
        console.log('WebSocket Service inicializado');
        
        await rabbitmqService.connect();
        console.log('RabbitMQ conectado');
        
        server.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/chat_app'}`);
            console.log(`RabbitMQ: ${process.env.RABBITMQ_URL || 'amqp://localhost'}`);
            console.log(`WebSocket: ws://localhost:${PORT}/ws`);
        });
        
    } catch (error) {
        console.error('Falha na inicialização dos serviços:', error);
        process.exit(1);
    }
}

function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\nRecebido ${signal}, encerrando servidor...`);
        
        try {
            server.close(() => {
                console.log('Servidor HTTP fechado');
            });
            
            await rabbitmqService.close();
            await mongodb.close();
            
            console.log('Todos os serviços foram encerrados');
            process.exit(0);
            
        } catch (error) {
            console.error('Erro durante o shutdown:', error);
            process.exit(1);
        }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2'));
}

initializeServices();
setupGracefulShutdown();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rejeição não tratada em:', promise, 'motivo:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Exceção não capturada:', error);
    process.exit(1);
});

module.exports = server;
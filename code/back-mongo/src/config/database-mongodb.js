const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

class MongoDB {
    constructor() {
        this.uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        this.dbName = process.env.DB_NAME || 'chat_app';
        this.client = null;
        this.db = null;
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected && this.db) {
            return this.db;
        }

        try {            
            this.client = new MongoClient(this.uri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 15000,
            });

            await this.client.connect();
            this.db = this.client.db(this.dbName);
            this.isConnected = true;

            
            // Create indexes
            await this.createIndexes();
            return this.db;

        } catch (error) {
            throw error;
        }
    }

    async createIndexes() {
        try {
            const db = await this.connect();
                        
            // Users collection
            await db.collection('users').createIndex({ email: 1 }, { unique: true });
            await db.collection('users').createIndex({ numeroTelefone: 1 }, { unique: true, sparse: true });
            await db.collection('users').createIndex({ status: 1 });
            await db.collection('users').createIndex({ "contatos.contatoId": 1 });
            
            // Messages collection
            await db.collection('messages').createIndex({ senderId: 1, recipientId: 1 });
            await db.collection('messages').createIndex({ recipientId: 1, status: 1 });
            // Support queries that match recipientIds array
            await db.collection('messages').createIndex({ recipientIds: 1 });
            await db.collection('messages').createIndex({ recipientIds: 1, status: 1 });
            await db.collection('messages').createIndex({ createdAt: -1 });
                        
        } catch (error) {
            console.error('⚠️  Erro ao criar alguns índices:', error.message);
        }
    }

    getObjectId(id) {
        if (!id) return null;
        try {
            return id instanceof ObjectId ? id : new ObjectId(id);
        } catch (error) {
            throw new Error(`ID inválido: ${id}`);
        }
    }

    isValidObjectId(id) {
        return ObjectId.isValid(id);
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.isConnected = false;
        }
    }

    async healthCheck() {
        try {
            const db = await this.connect();
            await db.command({ ping: 1 });
            return { 
                status: 'OK', 
                database: 'MongoDB',
                message: 'Conexão estabelecida com sucesso'
            };
        } catch (error) {
            return { 
                status: 'ERROR', 
                database: 'MongoDB',
                error: error.message 
            };
        }
    }
}

module.exports = new MongoDB();
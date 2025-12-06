const mongodb = require("../config/database-mongodb");
const bcrypt = require("bcrypt");
const { STATUS } = require("../../constants");

class User {
  constructor() {
    this.collectionName = "users";
    this.collection = null;
  }

  async getCollection() {
    if (!this.collection) {
      const db = await mongodb.connect();
      this.collection = db.collection(this.collectionName);
    }
    return this.collection;
  }

  async findByEmail(email) {
    const collection = await this.getCollection();
    return await collection.findOne({ email });
  }

  async findById(id) {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: mongodb.getObjectId(id) });
  }

  async findByPhone(numeroTelefone) {
    const collection = await this.getCollection();
    return await collection.findOne({ numeroTelefone });
  }

  async create(userData) {
    const collection = await this.getCollection();

    const hashedPassword = await bcrypt.hash(userData.senha, 10);
    const user = {
      nome: userData.nome.trim(),
      email: userData.email.toLowerCase().trim(),
      ...(userData.numeroTelefone !== undefined &&
      userData.numeroTelefone !== null
        ? { numeroTelefone: userData.numeroTelefone }
        : {}),
      idiomaPadrao: userData.idiomaPadrao || "pt-BR",
      status: STATUS.OFFLINE,
      senha: hashedPassword,
      contatos: [],
      conversasConfig: [],
      mensagemRecado: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await collection.insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  async updateProfileImageId(userId, imageId) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      {
        $set: {
          profileImageId: imageId,
          updatedAt: new Date(),
        },
      }
    );
    return result;
  }

  async updateRecado(userId, mensagemRecado) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      {
        $set: {
          mensagemRecado: mensagemRecado?.substring(0, 100) || "",
          updatedAt: new Date(),
        },
      }
    );
    return result;
  }

  async updateStatus(userId, status) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );
    return result;
  }

  async updateLanguage(userId, idioma) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      {
        $set: {
          idiomaPadrao: idioma,
          updatedAt: new Date(),
        },
      }
    );
    return result;
  }

  async addContact(userId, contactId, apelido = null) {
    const collection = await this.getCollection();

    const existingContact = await collection.findOne({
      _id: mongodb.getObjectId(userId),
      "contatos.contatoId": mongodb.getObjectId(contactId),
    });

    if (existingContact) {
      throw new Error("Contato já adicionado");
    }

    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      {
        $addToSet: {
          contatos: {
            contatoId: mongodb.getObjectId(contactId),
            apelido: apelido?.trim() || null,
            addedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      }
    );
    return result;
  }

  async removeContact(userId, contactId) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      {
        $pull: {
          contatos: { contatoId: mongodb.getObjectId(contactId) },
        },
        $set: { updatedAt: new Date() },
      }
    );
    return result;
  }

  async updateContactNickname(userId, contactId, apelido) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      {
        _id: mongodb.getObjectId(userId),
        "contatos.contatoId": mongodb.getObjectId(contactId),
      },
      {
        $set: {
          "contatos.$.apelido": apelido?.trim() || null,
          updatedAt: new Date(),
        },
      }
    );
    return result;
  }

  async getContacts(userId) {
    const collection = await this.getCollection();
    const user = await collection.findOne(
      { _id: mongodb.getObjectId(userId) },
      { projection: { contatos: 1 } }
    );
    return user?.contatos || [];
  }

  async updateProfile(userId, updateData) {
    const collection = await this.getCollection();
    const setData = { updatedAt: new Date() };

    const allowedFields = [
      "nome",
      "email",
      "numeroTelefone",
      "status",
      "mensagemRecado",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (field === "nome" && updateData[field]) {
          setData[field] = updateData[field].trim();
        } else if (field === "email" && updateData[field]) {
          setData[field] = updateData[field].toLowerCase().trim();
        } else if (field === "numeroTelefone") {
          setData[field] = updateData[field] || null;
        } else {
          setData[field] = updateData[field];
        }
      }
    });

    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      { $set: setData }
    );
    return result;
  }

  async updatePassword(userId, newPasswordHash) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(userId) },
      {
        $set: {
          senha: newPasswordHash,
          updatedAt: new Date(),
        },
      }
    );
    return result;
  }

  async searchUsers(searchParams, limit = 20, offset = 0) {
    const collection = await this.getCollection();
    const cursor = collection
      .find(searchParams)
      .skip(offset)
      .limit(limit)
      .sort({ nome: 1 });
    return await cursor.toArray();
  }
}

module.exports = new User();

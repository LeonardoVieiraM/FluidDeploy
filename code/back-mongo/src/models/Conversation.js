const mongodb = require("../config/database-mongodb");

class Conversation {
  constructor() {
    this.collectionName = "conversations";
    this.collection = null;
  }

  async getCollection() {
    if (!this.collection) {
      const db = await mongodb.connect();
      this.collection = db.collection(this.collectionName);
    }
    return this.collection;
  }

async create(convoData) {
  const collection = await this.getCollection();

  const participants = (convoData.participants || []).map((p) => mongodb.getObjectId(p));

  const participantsMeta = participants.map((p) => ({
    userId: p,
    archived: false,
    pinned: false,
    mutedUntil: null,
    deletedAt: null,
    clearedBefore: null,
  }));

  const conversation = {
    participants,
    participantsMeta,
    type: convoData.type || "direct",
    name: convoData.name || null,
    profileImageId: convoData.profileImageId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(conversation);
  return { ...conversation, _id: result.insertedId };
}

  async findDirectConversationBetween(userAId, userBId) {
    const collection = await this.getCollection();
    return await collection.findOne({
      type: "direct",
      participants: {
        $size: 2,
        $all: [mongodb.getObjectId(userAId), mongodb.getObjectId(userBId)],
      },
    });
  }

  async getOrCreateDirectConversation(userAId, userBId) {
    const collection = await this.getCollection();

    let convo = await this.findDirectConversationBetween(userAId, userBId);
    if (convo) return convo;

    const created = await this.create({
      participants: [userAId, userBId],
      type: "direct",
    });
    convo = await collection.findOne({ _id: created._id });
    return convo;
  }

  async listByOwner(ownerId, limit = 50, offset = 0) {
    const collection = await this.getCollection();
    const ownerObjId = mongodb.getObjectId(ownerId);
    const cursor = collection
      .find({
        participants: ownerObjId,
        "participantsMeta.userId": ownerObjId,
        "participantsMeta.deletedAt": null,
      })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit);
    return await cursor.toArray();
  }

  async updateGroupProfileImage(groupId, profileImageId) {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: mongodb.getObjectId(groupId), type: "group" },
      {
        $set: {
          profileImageId: profileImageId,
          updatedAt: new Date(),
        },
      }
    );
    return result;
  }

  async getGroupInfo(groupId) {
    const collection = await this.getCollection();
    return await collection.findOne({
      _id: mongodb.getObjectId(groupId),
      type: "group",
    });
  }
}

module.exports = new Conversation();

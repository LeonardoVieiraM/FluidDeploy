const mongodb = require("../config/database-mongodb");

class Message {
  constructor() {
    this.collectionName = "messages";
    this.collection = null;
  }

  async getCollection() {
    if (!this.collection) {
      const db = await mongodb.connect();
      this.collection = db.collection(this.collectionName);
    }
    return this.collection;
  }

  async create(messageData) {
    const collection = await this.getCollection();

    const atts = Array.isArray(messageData.attachments)
      ? messageData.attachments
          .filter(Boolean)
          .map((a) => ({
            fileId: a?.fileId || null,
            url: a?.url || (a?.fileId ? `/api/uploads/${a.fileId}` : null),
            mime: a?.mime || a?.mimetype || a?.contentType || null,
          }))
          .filter((x) => x.fileId && x.url)
      : [];

    const recipientIdsArr =
      Array.isArray(messageData.recipientIds) && messageData.recipientIds.length
        ? messageData.recipientIds.map((id) => mongodb.getObjectId(id))
        : messageData.recipientId
        ? [mongodb.getObjectId(messageData.recipientId)]
        : [];

    const message = {
      senderId: mongodb.getObjectId(messageData.senderId),
      recipientId: messageData.recipientId
        ? mongodb.getObjectId(messageData.recipientId)
        : null,
      recipientIds: recipientIdsArr,
      conversationId: messageData.conversationId
        ? mongodb.getObjectId(messageData.conversationId)
        : null,
      originalText: messageData.originalText || "",
      translatedText: messageData.translatedText || "",
      sourceLang: messageData.sourceLang || null,
      targetLang: messageData.targetLang || null,
      type: (
        messageData.type || (atts.length ? "image" : "text")
      ).toLowerCase(),
      attachments: atts,
      status: "sent",
      readBy: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(message);
    return { ...message, _id: result.insertedId };
  }

  async findByConversation(conversationId, limit = 50, offset = 0) {
    const collection = await this.getCollection();
    if (!conversationId) return [];
    const cursor = collection
      .find({ conversationId: mongodb.getObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
    return await cursor.toArray();
  }

  async markAsDelivered(recipientId, senderId) {
    const collection = await this.getCollection();
    const objId = mongodb.getObjectId(recipientId);
    const result = await collection.updateMany(
      {
        $and: [
          { senderId: mongodb.getObjectId(senderId) },
          { status: "sent" },
          { $or: [{ recipientId: objId }, { recipientIds: objId }] },
        ],
      },
      {
        $set: { status: "delivered", updatedAt: new Date() },
      }
    );
    return result;
  }

  async markAsRead(userId, otherUserId, untilMessageId = null) {
    const collection = await this.getCollection();
    const uid = mongodb.getObjectId(userId);
    const query = {
      $and: [
        { senderId: mongodb.getObjectId(otherUserId) },
        { status: { $in: ["sent", "delivered"] } },
        { $or: [{ recipientId: uid }, { recipientIds: uid }] },
      ],
    };
    if (untilMessageId)
      query._id = { $lte: mongodb.getObjectId(untilMessageId) };

    const result = await collection.updateMany(query, {
      $set: { status: "read", updatedAt: new Date() },
      $addToSet: { readBy: mongodb.getObjectId(userId) },
    });
    return result;
  }

  async markAsReadByConversation(
    userId,
    conversationId,
    untilMessageId = null
  ) {
    const collection = await this.getCollection();
    const query = {
      conversationId: mongodb.getObjectId(conversationId),
      status: { $in: ["sent", "delivered"] },
      readBy: { $ne: mongodb.getObjectId(userId) },
    };
    if (untilMessageId)
      query._id = { $lte: mongodb.getObjectId(untilMessageId) };

    const result = await collection.updateMany(query, {
      $set: { status: "read", updatedAt: new Date() },
      $addToSet: { readBy: mongodb.getObjectId(userId) },
    });
    return result;
  }

  async countUnreadByConversation(userId) {
    const collection = await this.getCollection();
    const uid = mongodb.getObjectId(userId);
    const directPipeline = [
      {
        $match: {
          $and: [
            { status: { $in: ["sent", "delivered"] } },
            { $or: [{ recipientId: uid }, { recipientIds: uid }] },
          ],
        },
      },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
    ];
    const directResult = await collection.aggregate(directPipeline).toArray();

    const convoPipeline = [
      {
        $match: {
          conversationId: { $ne: null },
          status: { $in: ["sent", "delivered"] },
          readBy: { $ne: mongodb.getObjectId(userId) },
        },
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "_id",
          as: "convo",
        },
      },
      { $unwind: "$convo" },
      { $match: { "convo.participants": mongodb.getObjectId(userId) } },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ];
    const convoResult = await collection.aggregate(convoPipeline).toArray();

    const countsMap = new Map();
    for (const item of directResult) {
      const key = item._id.toString();
      countsMap.set(key, (countsMap.get(key) || 0) + item.count);
    }
    for (const item of convoResult) {
      const key = item._id.toString();
      countsMap.set(key, (countsMap.get(key) || 0) + item.count);
    }

    const mapped = [];
    for (const [otherUserId, count] of countsMap.entries())
      mapped.push({ otherUserId, count });
    return mapped;
  }

  async findById(messageId) {
    const collection = await this.getCollection();
    return await collection.findOne({ _id: mongodb.getObjectId(messageId) });
  }
}

module.exports = new Message();

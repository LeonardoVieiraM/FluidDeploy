const { User, Message, Conversation } = require("../models");
const translationService = require("./translationService");
const rabbitmqService = require("./rabbitmqService");
const mongodb = require("../config/database-mongodb");

class MensagemService {
  async enviarMensagem(senderId, recipientId, text, sourceLang, options = {}) {
    const { translated, type = "text", attachments = [] } = options || {};
    const isImage =
      type === "image" && Array.isArray(attachments) && attachments.length > 0;

    if (!recipientId || (!isImage && (!text || !String(text).trim()))) {
      throw new Error("Parâmetros inválidos");
    }
    if (senderId === recipientId) {
      throw new Error("Não é possível enviar mensagem para si mesmo");
    }

    const [sender, recipient] = await Promise.all([
      User.findById(senderId),
      User.findById(recipientId),
    ]);
    if (!sender || !recipient) {
      throw new Error("Remetente ou destinatário não encontrado");
    }

    const targetLang = recipient.idiomaPadrao;
    let translatedText = isImage ? "" : text || "";
    let detectedSource = sourceLang || null;

    const skipTranslation = translated === false;

    if (
      !isImage &&
      !skipTranslation &&
      sender.idiomaPadrao !== recipient.idiomaPadrao &&
      translatedText.trim()
    ) {
      try {
        const result = await translationService.safeTranslate(translatedText, {
          sourceLang: sourceLang || sender.idiomaPadrao,
          targetLang,
        });
        translatedText = result.translatedText;
        detectedSource =
          result.detectedSourceLang || sourceLang || sender.idiomaPadrao;
      } catch (error) {
        console.error("Erro na tradução segura:", error);
        translatedText = text || "";
      }
    }

    const convo = await Conversation.getOrCreateDirectConversation(
      senderId,
      recipientId
    );

    try {
      const coll = await mongodb.connect();
      const convColl = coll.collection("conversations");
      const meta = (convo.participantsMeta || []).find(
        (m) => m.userId.toString() === mongodb.getObjectId(senderId).toString()
      );
      if (meta && meta.deletedAt) {
        await convColl.updateOne(
          {
            _id: convo._id,
            "participantsMeta.userId": mongodb.getObjectId(senderId),
          },
          { $set: { "participantsMeta.$.deletedAt": null } }
        );
      }
    } catch (e) {
      console.warn("Falha ao limpar deletedAt da conversa:", e.message);
    }

    const normalizedAttachments = isImage
      ? attachments
          .map((att) => ({
            fileId: att.fileId,
            url: att.url || (att.fileId ? `/api/uploads/${att.fileId}` : null),
            mime: att.mime || att.mimetype || att.contentType || "image/jpeg",
          }))
          .filter((att) => att.fileId && att.url)
      : [];

    const recipients = (convo.participants || [])
      .map((p) => p.toString())
      .filter((p) => p !== senderId);
    const otherParticipant = recipients.length === 1 ? recipients[0] : null;

    const msg = await Message.create({
      senderId,
      recipientId: otherParticipant || null,
      recipientIds: recipients,
      conversationId: convo._id,
      originalText: text || "",
      translatedText: isImage ? "" : translatedText,
      sourceLang: isImage ? null : detectedSource,
      targetLang: isImage ? null : targetLang,
      type: isImage ? "image" : "text",
      attachments: normalizedAttachments,
      status: "sent",
    });

    try {
      const coll = await mongodb.connect();
      await coll
        .collection("conversations")
        .updateOne(
          { _id: mongodb.getObjectId(convo._id) },
          { $set: { updatedAt: new Date() } }
        );
    } catch (e) {
      console.warn("Falha ao atualizar updatedAt da conversa", e.message);
    }

    for (const r of recipients) {
      await rabbitmqService.publishMessage({
        type: "new_message",
        message: {
          id: msg._id.toString(),
          _id: msg._id.toString(),
          senderId: msg.senderId.toString(),
          senderName: sender.nome || null,
          senderImagemPerfil: sender.imagemPerfil || null,
          recipientId: msg.recipientId ? msg.recipientId.toString() : null,
          recipientIds: recipients.slice(),
          originalText: msg.originalText,
          translatedText: msg.translatedText,
          sourceLang: msg.sourceLang,
          targetLang: msg.targetLang,
          type: msg.type,
          attachments: msg.attachments || [],
          status: msg.status,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          conversationId: msg.conversationId
            ? msg.conversationId.toString()
            : null,
        },
        recipientId: r,
      });
    }

    return msg;
  }

  async deletarConversa(userId, otherUserId) {
    const coll = await (
      await require("../config/database-mongodb").connect()
    ).collection("conversations");
    const convo = await coll.findOne({
      type: "direct",
      participants: {
        $size: 2,
        $all: [mongodb.getObjectId(userId), mongodb.getObjectId(otherUserId)],
      },
    });
    if (!convo) return { deleted: 0 };

    const r = await coll.updateOne(
      {
        _id: convo._id,
        "participantsMeta.userId": mongodb.getObjectId(userId),
      },
      { $set: { "participantsMeta.$.deletedAt": new Date() } }
    );

    await rabbitmqService.publishMessage({
      type: "conversation_deleted",
      data: { userId, otherUserId, updated: r.modifiedCount },
      recipientId: otherUserId,
    });

    return { deleted: r.modifiedCount };
  }

  async listarConversa(userId, otherUserId, limit = 50, offset = 0) {
    if (!otherUserId) {
      throw new Error("Parâmetros inválidos");
    }
    const convo = await Conversation.getOrCreateDirectConversation(
      userId,
      otherUserId
    );
    if (!convo) return [];

    const meta = (convo.participantsMeta || []).find(
      (m) => m.userId.toString() === mongodb.getObjectId(userId).toString()
    );
    const clearedBefore = meta ? meta.clearedBefore : null;

    let itens = await Message.findByConversation(convo._id, limit, offset);
    if (clearedBefore) {
      itens = itens.filter(
        (m) => new Date(m.createdAt) > new Date(clearedBefore)
      );
    }
    await Message.markAsDelivered(userId, otherUserId);
    return itens;
  }

  async marcarConversaComoLida(userId, otherUserId, untilMessageId) {
    const result = await Message.markAsRead(
      userId,
      otherUserId,
      untilMessageId
    );

    await rabbitmqService.publishMessage({
      type: "messages_read",
      data: {
        userId,
        otherUserId,
        untilMessageId,
        updatedCount: result.modifiedCount,
      },
      recipientId: otherUserId,
    });

    return { updated: result.modifiedCount };
  }

  async marcarConversaComoLidaPorConversa(
    userId,
    conversationId,
    untilMessageId
  ) {
    const result = await Message.markAsReadByConversation(
      userId,
      conversationId,
      untilMessageId
    );

    try {
      const Conversation = require("../models/Conversation");
      const coll = await Conversation.getCollection();
      const conv = await coll.findOne({
        _id: require("../config/database-mongodb").getObjectId(conversationId),
      });
      if (conv && Array.isArray(conv.participants)) {
        for (const participant of conv.participants.map((p) => p.toString())) {
          if (participant === String(userId)) continue;
          await rabbitmqService.publishMessage({
            type: "messages_read",
            data: {
              userId,
              conversationId,
              untilMessageId,
              updatedCount: result.modifiedCount,
            },
            recipientId: participant,
          });
        }
      }
    } catch (e) {
      console.warn("Falha ao notificar leitura por conversa:", e.message);
    }

    return { updated: result.modifiedCount };
  }

  async contarNaoLidasPorConversa(userId) {
    const unreadCounts = await Message.countUnreadByConversation(userId);
    return unreadCounts.map((item) => ({
      otherUserId: item.otherUserId,
      count: item.count,
    }));
  }

  async enviarMensagemPorConversa(
    senderId,
    conversationId,
    text,
    sourceLang,
    options = {}
  ) {
    try {
      const { translated, type = "text", attachments = [] } = options || {};
      const isImage =
        type === "image" &&
        Array.isArray(attachments) &&
        attachments.length > 0;

      if (!conversationId || (!isImage && (!text || !String(text).trim()))) {
        throw new Error("Parâmetros inválidos");
      }

      const coll = await mongodb.connect();
      const convColl = coll.collection("conversations");
      const convo = await convColl.findOne({
        _id: mongodb.getObjectId(conversationId),
      });

      if (!convo) {
        throw new Error("Conversa não encontrada");
      }

      const participants = (convo.participants || []).map((p) => p.toString());
      if (!participants.includes(senderId)) {
        throw new Error("Você não é participante desta conversa");
      }

      const sender = await User.findById(senderId);
      if (!sender) {
        throw new Error("Remetente não encontrado");
      }

      const isDirect = participants.length === 2;
      const recipients = participants.filter((p) => p !== senderId);

      let targetLang = null;
      let translatedText = isImage ? "" : text || "";
      let detectedSource = sourceLang || null;
      const skipTranslation = translated === false;

      if (isDirect && recipients.length === 1) {
        const recipientId = recipients[0];
        const recipient = await User.findById(recipientId);
        if (recipient) {
          targetLang = recipient.idiomaPadrao;

          if (
            !isImage &&
            !skipTranslation &&
            sender.idiomaPadrao !== recipient.idiomaPadrao &&
            translatedText.trim()
          ) {
            try {
              const result = await translationService.safeTranslate(
                translatedText,
                {
                  sourceLang: sourceLang || sender.idiomaPadrao,
                  targetLang,
                }
              );
              translatedText = result.translatedText;
              detectedSource =
                result.detectedSourceLang || sourceLang || sender.idiomaPadrao;
            } catch (error) {
              console.error("Erro na tradução segura:", error);
              translatedText = text || "";
            }
          }
        }
      } else {
        translatedText = isImage ? "" : text || "";
        detectedSource = sourceLang || sender.idiomaPadrao || null;
        targetLang = null;
      }

      const normalizedAttachments = isImage
        ? attachments
            .map((att) => ({
              fileId: att.fileId,
              url:
                att.url || (att.fileId ? `/api/uploads/${att.fileId}` : null),
              mime: att.mime || att.mimetype || att.contentType || "image/jpeg",
            }))
            .filter((att) => att.fileId && att.url)
        : [];

      const msg = await Message.create({
        senderId,
        recipientId: isDirect && recipients.length === 1 ? recipients[0] : null,
        recipientIds: recipients,
        conversationId: convo._id,
        originalText: text || "",
        translatedText: isImage ? "" : translatedText,
        sourceLang: isImage ? null : detectedSource,
        targetLang: isImage ? null : targetLang,
        type: isImage ? "image" : "text",
        attachments: normalizedAttachments,
        status: "sent",
      });

      try {
        await convColl.updateOne(
          { _id: mongodb.getObjectId(conversationId) },
          { $set: { updatedAt: new Date() } }
        );
      } catch (e) {
        console.warn("Falha ao atualizar updatedAt da conversa", e.message);
      }

      for (const r of recipients) {
        const messageToSend = {
          id: msg._id.toString(),
          _id: msg._id.toString(),
          senderId: msg.senderId.toString(),
          senderName: sender.nome || null,
          senderImagemPerfil: sender.imagemPerfil || null,
          recipientId:
            isDirect && recipients.length === 1 ? msg.recipientId : null,
          recipientIds: recipients.slice(),
          originalText: msg.originalText,
          translatedText: msg.translatedText,
          sourceLang: msg.sourceLang,
          targetLang: isDirect ? msg.targetLang : null,
          type: msg.type,
          attachments: msg.attachments || [],
          status: msg.status,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          conversationId: msg.conversationId
            ? msg.conversationId.toString()
            : null,
        };

        await rabbitmqService.publishMessage({
          type: "new_message",
          message: messageToSend,
          recipientId: r,
        });
      }
      return msg;
    } catch (error) {
      console.error("[enviarMensagemPorConversa] Erro:", error);
      throw error;
    }
  }
}

module.exports = new MensagemService();

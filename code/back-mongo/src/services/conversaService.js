const { User, Message } = require("../models");
const mensagemService = require("./mensagemService");
const { Conversation } = require("../models");

class ConversaService {
  async listarConversas(userId, { limit = 20, scanWindow = 500 } = {}) {
    try {
      const userContacts = await User.getContacts(userId);
      const contactIds = new Set(
        userContacts.map((c) => c.contatoId.toString())
      );

      const conversationsDocs = await Conversation.listByOwner(
        userId,
        Math.max(limit, 100),
        0
      );
      if (!conversationsDocs || conversationsDocs.length === 0) return [];

      const otherIds = conversationsDocs.map((c) => {
        if (c.type === "direct") {
          const parts = c.participants.map((p) => p.toString());
          return parts.find((p) => p !== userId) || null;
        }
        return null;
      });

      const uniqueOtherIds = Array.from(new Set(otherIds.filter(Boolean)));
      const usuarios = await Promise.all(
        uniqueOtherIds.map((id) => User.findById(id))
      );
      const userById = new Map();
      usuarios.forEach((u) => {
        if (u) userById.set(u._id.toString(), u);
      });

      const unread = await mensagemService.contarNaoLidasPorConversa(userId);
      const unreadMap = new Map(unread.map((r) => [r.otherUserId, r.count]));

      const cfgMap = new Map();

      const conversations = [];
      for (const convo of conversationsDocs) {
        let otherId = null;
        let isGroup = convo.type === "group";
        if (convo.type === "direct") {
          const parts = convo.participants.map((p) => p.toString());
          otherId = parts.find((p) => p !== userId) || null;
        }

        const lastMsgs = await Message.findByConversation(convo._id, 1, 0);
        const last = lastMsgs && lastMsgs.length ? lastMsgs[0] : null;

        const participant = otherId ? userById.get(otherId) : null;
        const cfg = otherId ? cfgMap.get(otherId) : null;

        const config = cfg
          ? {
              arquivada: !!cfg.arquivada,
              fixada: !!cfg.fixada,
              silenciada: !!cfg.silenciada,
              muteUntil: cfg.muteUntil,
            }
          : {
              arquivada: false,
              fixada: false,
              silenciada: false,
              muteUntil: null,
            };

        const isNonContact = otherId ? !contactIds.has(otherId) : false;

        let otherUserForList = null;
        if (isGroup) {
          let imagemPerfil = null;

          if (convo.profileImageId) {
            const imageId = convo.profileImageId.toString();
            imagemPerfil = {
              id: imageId,
              url: `/api/uploads/${imageId}`,
            };
          } else {
            // Se não tiver imagem customizada, usa a imagem padrão
            imagemPerfil = 'default-group';
          }

          otherUserForList = {
            id: convo._id.toString(),
            nome: convo.name || `Grupo (${(convo.participants || []).length})`,
            email: null,
            status: "group",
            imagemPerfil: imagemPerfil,
            profileImageId: convo.profileImageId
              ? convo.profileImageId.toString()
              : null,
            isGroup: true,
            participants: convo.participants || [],
            admins: convo.groupSettings?.admins || [],
          };
        } else if (participant) {
          otherUserForList = {
            id: participant._id.toString(),
            nome: participant.nome,
            email: participant.email,
            status: participant.status,
            imagemPerfil: participant.imagemPerfil || null,
          };
        } else if (otherId) {
          otherUserForList = {
            id: otherId,
            nome: "Usuário",
            status: "offline",
            imagemPerfil: null,
          };
        }

        const unreadKey = isGroup ? convo._id.toString() : otherId;

        conversations.push({
          id: convo._id.toString(),
          type: convo.type,
          otherUser: otherUserForList,
          lastMessage: last
            ? {
                id: last._id.toString(),
                senderId: last.senderId.toString(),
                recipientId: last.recipientId
                  ? last.recipientId.toString()
                  : null,
                originalText: last.originalText,
                translatedText: last.translatedText,
                status: last.status,
                createdAt: last.createdAt,
              }
            : null,
          unreadCount: unreadKey ? unreadMap.get(unreadKey) || 0 : 0,
          config,
          isNonContact,
        });
      }

      return conversations.sort((a, b) => {
        if ((a.config?.fixada || false) !== (b.config?.fixada || false))
          return a.config?.fixada ? -1 : 1;
        const aDate = a.lastMessage
          ? new Date(a.lastMessage.createdAt).getTime()
          : 0;
        const bDate = b.lastMessage
          ? new Date(b.lastMessage.createdAt).getTime()
          : 0;
        return bDate - aDate;
      });
    } catch (error) {
      console.error("Erro ao listar conversas:", error);
      throw error;
    }
  }

  async atualizarConfig(
    userId,
    otherUserId,
    { arquivada, fixada, silenciada, muteUntil }
  ) {
    const config = {};
    if (arquivada !== undefined) config.arquivada = arquivada;
    if (fixada !== undefined) config.fixada = fixada;
    if (silenciada !== undefined) config.silenciada = silenciada;
    if (muteUntil !== undefined) config.muteUntil = muteUntil;

    if (result.modifiedCount === 0 && result.upsertedCount === 0) {
      throw new Error("Falha ao atualizar configuração da conversa");
    }

    return { success: true };
  }
}

module.exports = new ConversaService();

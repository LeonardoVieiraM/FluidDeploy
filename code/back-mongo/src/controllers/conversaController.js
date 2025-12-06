const conversaService = require("../services/conversaService");

const Conversation = require("../models/Conversation");
const mensagemService = require("../services/mensagemService");

class ConversaController {
  async listar(req, res) {
    try {
      const userId = req.userId;
      const { limit = 20, scanWindow } = req.query;

      const itens = await conversaService.listarConversas(userId, {
        limit: parseInt(limit),
        scanWindow: scanWindow ? parseInt(scanWindow) : undefined,
      });

      res.json(itens);
    } catch (error) {
      console.error("Erro ao listar conversas:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async atualizarConfig(req, res) {
    try {
      const userId = req.userId;
      const { otherUserId } = req.params;
      const { arquivar, fixar, silenciar, muteUntil } = req.body;

      const result = await conversaService.atualizarConfig(
        userId,
        parseInt(otherUserId),
        {
          arquivada: arquivar,
          fixada: fixar,
          silenciada: silenciar,
          muteUntil,
        }
      );

      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar config da conversa:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async getOrCreate(req, res) {
    try {
      const userId = req.userId;
      const body = req.body || {};

      if (body.type === "group") {
        const name = body.name || null;
        const participants = Array.isArray(body.participants)
          ? body.participants.map(String)
          : [];
        const profileImageId = body.profileImageId || null;

        if (!participants.includes(String(userId)))
          participants.push(String(userId));
        if (participants.length < 2)
          return res.status(400).json({
            error:
              "É necessário pelo menos 2 participantes para criar um grupo",
          });

        const created = await Conversation.create({
          participants,
          type: "group",
          name,
          profileImageId,
          createdBy: userId,
          admins: [userId],
        });

        const convo = await Conversation.getCollection().then((c) =>
          c.findOne({
            _id: require("../config/database-mongodb").getObjectId(created._id),
          })
        );
        return res.json({ success: true, data: convo });
      }

      const { otherUserId } = body;
      if (!otherUserId)
        return res.status(400).json({ error: "otherUserId necessário" });

      const convo = await Conversation.getOrCreateDirectConversation(
        userId,
        otherUserId
      );
      res.json({ success: true, data: convo });
    } catch (error) {
      console.error("Erro ao criar/obter conversa:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async getGroupProfileImage(req, res) {
    try {
      const { groupId } = req.params;

      if (!groupId) {
        return res.status(400).json({ error: "groupId necessário" });
      }

      const group = await Conversation.getGroupInfo(groupId);
      if (!group) {
        return res.status(404).json({ error: "Grupo não encontrado" });
      }

      const isParticipant = group.participants?.some(
        (p) => p.toString() === req.userId.toString()
      );

      if (!isParticipant) {
        return res.status(403).json({ error: "Acesso não autorizado" });
      }

      if (!group.profileImageId) {
        return res
          .status(404)
          .json({ error: "Grupo não possui imagem de perfil" });
      }

      const fileInfo = await imageService.getGroupProfileImageById(
        group.profileImageId
      );

      res.set("Content-Type", fileInfo.contentType || "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400");
      res.set("Content-Length", fileInfo.length);

      const stream = await imageService.getImageStream(group.profileImageId);

      stream.on("error", (error) => {
        console.error("Erro no stream da imagem do grupo:", error);
        if (!res.headersSent) {
          return res.status(500).json({ error: "Erro ao recuperar imagem" });
        }
      });

      stream.pipe(res);

      req.on("close", () => {
        if (stream.destroy) {
          stream.destroy();
        }
      });
    } catch (error) {
      console.error("Erro ao obter imagem do grupo:", error);

      if (!res.headersSent) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: "Imagem não encontrada" });
        }
        return res.status(500).json({ error: "Erro interno do servidor" });
      }
    }
  }

  async updateGroupProfileImage(req, res) {
    try {
      const userId = req.userId;
      const { groupId } = req.params;
      const { profileImageId } = req.body;

      if (!groupId) {
        return res.status(400).json({ error: "groupId necessário" });
      }

      if (!profileImageId) {
        return res.status(400).json({ error: "profileImageId necessário" });
      }

      const group = await Conversation.getGroupInfo(groupId);
      if (!group) {
        return res.status(404).json({ error: "Grupo não encontrado" });
      }

      const isAdmin = group.groupSettings?.admins?.some(
        (admin) => admin.toString() === userId.toString()
      );

      if (!isAdmin) {
        return res.status(403).json({
          error: "Apenas administradores podem alterar a imagem do grupo",
        });
      }

      const result = await Conversation.updateGroupProfileImage(
        groupId,
        profileImageId
      );

      if (result.modifiedCount === 0) {
        return res
          .status(400)
          .json({ error: "Falha ao atualizar imagem do grupo" });
      }

      const updatedGroup = await Conversation.getGroupInfo(groupId);
      res.json({ success: true, data: updatedGroup });
    } catch (error) {
      console.error("Erro ao atualizar imagem do grupo:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async getMessages(req, res) {
    try {
      const userId = req.userId;
      const { conversationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!conversationId)
        return res.status(400).json({ error: "conversationId necessário" });

      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const ConversationModel = require("../models/Conversation");
      const conv = (await ConversationModel.getCollection)
        ? await ConversationModel.getCollection().then((c) =>
            c.findOne({
              _id: require("../config/database-mongodb").getObjectId(
                conversationId
              ),
            })
          )
        : null;
      if (!conv)
        return res.status(404).json({ error: "Conversa não encontrada" });

      const isParticipant =
        Array.isArray(conv.participants) &&
        conv.participants.map((p) => String(p)).includes(String(userId));
      if (!isParticipant)
        return res
          .status(403)
          .json({ error: "Usuário não participa da conversa" });

      const meta = (conv.participantsMeta || []).find(
        (m) => String(m.userId) === String(userId)
      );
      if (meta && meta.deletedAt) {
        const convoForClient = { ...conv, deletedForUser: true };
        return res.json({
          success: true,
          data: { conversation: convoForClient, messages: [] },
        });
      }

      const Message = require("../models/Message");
      let mensagens = await Message.findByConversation(
        conversationId,
        parseInt(limit),
        parseInt(offset)
      );

      if (meta && meta.clearedBefore) {
        const clearedDate = new Date(meta.clearedBefore);
        mensagens = (mensagens || []).filter(
          (m) => new Date(m.createdAt) > clearedDate
        );
      }

      if (
        meta &&
        meta.clearedBefore &&
        (!mensagens || mensagens.length === 0)
      ) {
        const convoForClient = { ...conv, clearedForUser: true };
        return res.json({
          success: true,
          data: { conversation: convoForClient, messages: [] },
        });
      }

      if (mensagens && mensagens.length > 0) {
        const User = require("../models/User");
        const senderIds = [
          ...new Set(
            mensagens.map((m) => m.senderId?.toString()).filter(Boolean)
          ),
        ];

        const senderPromises = senderIds.map(async (senderId) => {
          try {
            const sender = await User.findById(senderId);
            if (sender) {
              return {
                id: senderId,
                nome: sender.nome || null,
                imagemPerfil: sender.imagemPerfil || null,
              };
            } else {
              console.warn(`⚠️ Remetente não encontrado no banco: ${senderId}`);
            }
          } catch (error) {
            console.warn(
              `⚠️ Erro ao buscar remetente ${senderId}:`,
              error.message
            );
          }
          return null;
        });

        const senderResults = await Promise.all(senderPromises);
        const senderMap = new Map();
        senderResults.forEach((result) => {
          if (result) {
            senderMap.set(result.id, {
              nome: result.nome,
              imagemPerfil: result.imagemPerfil,
            });
            const mongodb = require("../config/database-mongodb");
            try {
              const objId = mongodb.getObjectId(result.id);
              senderMap.set(objId.toString(), {
                nome: result.nome,
                imagemPerfil: result.imagemPerfil,
              });
            } catch (e) {}
          }
        });

        mensagens = mensagens.map((msg) => {
          let senderId = msg.senderId;
          if (senderId && typeof senderId === "object" && senderId.toString) {
            senderId = senderId.toString();
          } else if (senderId) {
            senderId = String(senderId);
          }

          let senderInfo = null;
          if (senderId) {
            if (senderMap.has(senderId)) {
              senderInfo = senderMap.get(senderId);
            } else {
              for (const [key, value] of senderMap.entries()) {
                if (String(key) === String(senderId)) {
                  senderInfo = value;
                  break;
                }
              }
            }
          }

          if (senderInfo && senderInfo.nome) {
            const enrichedMsg = {
              ...msg,
              senderName: senderInfo.nome,
              senderImagemPerfil: senderInfo.imagemPerfil || null,
            };
            return enrichedMsg;
          }

          console.warn(
            `⚠️ Sender ${senderId} não encontrado no mapa para mensagem ${
              msg._id || msg.id
            }. senderMap tem ${senderMap.size} entradas.`
          );
          return {
            ...msg,
            senderName: msg.senderName || null,
            senderImagemPerfil: msg.senderImagemPerfil || null,
          };
        });
      }

      res.json({
        success: true,
        data: { conversation: conv, messages: mensagens },
      });
    } catch (error) {
      console.error("Erro ao obter mensagens da conversa:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async deleteForUser(req, res) {
    try {
      const userId = req.userId;
      const { conversationId } = req.params;
      if (!conversationId)
        return res.status(400).json({ error: "conversationId necessário" });

      const db = await require("../config/database-mongodb").connect();
      const coll = db.collection("conversations");
      let convo = null;
      const isObjectIdLike = /^[0-9a-fA-F]{24}$/.test(String(conversationId));
      if (isObjectIdLike) {
        convo = await coll.findOne({
          _id: require("../config/database-mongodb").getObjectId(
            conversationId
          ),
        });
      } else {
        const otherUserId = conversationId;
        convo = await coll.findOne({
          type: "direct",
          participants: {
            $size: 2,
            $all: [
              require("../config/database-mongodb").getObjectId(userId),
              require("../config/database-mongodb").getObjectId(otherUserId),
            ],
          },
        });
      }

      if (!convo)
        return res.status(404).json({ error: "Conversa não encontrada" });

      const r = await coll.updateOne(
        {
          _id: convo._id,
          "participantsMeta.userId":
            require("../config/database-mongodb").getObjectId(userId),
        },
        { $set: { "participantsMeta.$.deletedAt": new Date() } }
      );
      res.json({ success: true, data: { modifiedCount: r.modifiedCount } });
    } catch (error) {
      console.error("Erro ao deletar conversa para usuário:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async markAsReadByConversation(req, res) {
    try {
      const userId = req.userId;
      const { conversationId } = req.params;
      const { untilMessageId } = req.body || {};
      if (!conversationId)
        return res.status(400).json({ error: "conversationId necessário" });

      const result = await mensagemService.marcarConversaComoLidaPorConversa(
        userId,
        conversationId,
        untilMessageId ? untilMessageId : undefined
      );
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Erro ao marcar conversa como lida por id:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async getDefaultGroupImage(req, res) {
    try {
      const { DEFAULT_GROUP_IMAGE_PATH } = require('../../defaultGroupImage');
      return res.sendFile(DEFAULT_GROUP_IMAGE_PATH);
    } catch (error) {
      console.error("Erro ao buscar imagem padrão de grupo:", error);
      res.status(404).json({ error: "Imagem padrão de grupo não encontrada" });
    }
  }
}

module.exports = new ConversaController();

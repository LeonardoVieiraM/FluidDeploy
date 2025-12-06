// controllers/MensagemController.js
const mensagemService = require("../services/mensagemService");
const websocketService = require("../services/websocketService");

class MensagemController {
  async enviar(req, res) {
    try {
      const senderId = req.userId;

      const {
        recipientId,
        text,
        sourceLang,
        translated,
        type = "text",
        attachments = []
      } = req.body || {};

      const msg = await mensagemService.enviarMensagem(
        senderId,
        recipientId,
        text || "",
        sourceLang,
        { translated, type, attachments }
      );

      res.status(201).json(msg);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async listarConversa(req, res) {
    try {
      const userId = req.userId;
      const { otherUserId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const itens = await mensagemService.listarConversa(
        userId,
        otherUserId,
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      res.json(itens);
    } catch (error) {
      console.error("Erro ao listar conversa:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async marcarConversaComoLida(req, res) {
    try {
      const userId = req.userId;
      const { otherUserId } = req.params;
      const { untilMessageId } = req.body || {};

      const result = await mensagemService.marcarConversaComoLida(
        userId,
        otherUserId,
        untilMessageId ? untilMessageId : undefined
      );

      res.json(result);
    } catch (error) {
      console.error("Erro ao marcar conversa como lida:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async contarNaoLidas(req, res) {
    try {
      const userId = req.userId;
      const itens = await mensagemService.contarNaoLidasPorConversa(userId);
      res.json(itens);
    } catch (error) {
      console.error("Erro ao contar não lidas:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async deletarConversa(req, res) {
    try {
      const userId = req.userId;
      const { otherUserId } = req.params;

      const result = await mensagemService.deletarConversa(userId, otherUserId);
      res.json(result);
    } catch (error) {
      console.error("Erro ao deletar conversa:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async getWebSocketToken(req, res) {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Token não fornecido" });
      res.json({ token });
    } catch (error) {
      console.error("Erro ao gerar token WebSocket:", error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new MensagemController();

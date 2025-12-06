const WebSocket = require("ws");
const rabbitmqService = require("./rabbitmqService");
const mongodb = require("../config/database-mongodb");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server, path: "/ws" });

    this.wss.on("connection", (ws, req) => {
      const clientIp = req.socket.remoteAddress;

      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data);
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error("Erro ao processar mensagem WebSocket:", error);
          this.sendToClient(ws, { type: "error", error: "Mensagem inválida" });
        }
      });

      ws.on("close", (code) => {
        this.handleDisconnection(ws);
      });

      ws.on("error", (error) => {
        console.error("Erro WebSocket:", error);
        console.error("Usuário afetado:", ws.userId || "não autenticado");
        this.handleDisconnection(ws);
      });
    });

    rabbitmqService.addSubscriber("notification", (notification) => {
      this.broadcastToClients(notification);
    });
  }

  async handleMessage(ws, message) {
    switch (message.type) {
      case "authenticate":
        await this.handleAuthentication(ws, message);
        break;
      case "subscribe_messages":
        await this.handleSubscribeMessages(ws, message);
        break;
      case "send_message":
        await this.handleSendMessage(ws, message);
        break;
      case "mark_read":
        await this.handleMarkRead(ws, message);
        break;
      default:
        this.sendToClient(ws, {
          type: "error",
          error: "Tipo de mensagem desconhecido",
        });
    }
  }

  async handleAuthentication(ws, message) {
    try {
      const user = await this.verifyToken(message.token);
      if (user) {
        const userId = user._id.toString();

        const existingWs = this.clients.get(userId);
        if (existingWs) {
          console.warn(
            `Já existe um WebSocket para usuário ${userId}, será substituído`
          );
          console.warn(
            `Estado do WebSocket antigo: ${
              existingWs.readyState === 1 ? "OPEN" : "CLOSED"
            }`
          );
        }

        this.clients.set(userId, ws);
        ws.userId = userId;
        if (!this.clients.has(ws.userId + "_subscribed")) {
          try {
            await rabbitmqService.subscribeToUserMessages(
              ws.userId,
              (messageData) => {
                const allClients = Array.from(this.clients.keys()).filter(
                  (k) => !k.includes("_subscribed")
                );
                const currentWs = this.clients.get(ws.userId);
                if (currentWs) {
                  const isOpen = currentWs.readyState === 1;
                  const readyStateNames = [
                    "CONNECTING",
                    "OPEN",
                    "CLOSING",
                    "CLOSED",
                  ];
                  if (isOpen) {
                  } else {
                    console.warn(
                      `WebSocket do usuário ${ws.userId} existe mas está ${
                        readyStateNames[currentWs.readyState]
                      }, não enviando`
                    );
                  }
                } else {
                  console.error(
                    `[CALLBACK] ERRO: Nenhum WebSocket encontrado no Map para usuário ${ws.userId}`
                  );
                  console.error(
                    `[CALLBACK] Usuário deveria estar em:`,
                    allClients
                  );
                }
              }
            );

            this.clients.set(ws.userId + "_subscribed", true);
          } catch (rabbitmqError) {
            console.error("Erro ao inscrever no RabbitMQ:", rabbitmqError);
            console.error("Stack trace:", rabbitmqError.stack);
          }
        }

        this.sendToClient(ws, {
          type: "authenticated",
          user: {
            id: user._id.toString(),
            nome: user.nome,
            email: user.email,
          },
        });
      } else {
        this.sendToClient(ws, { type: "auth_error", error: "Token inválido" });
      }
    } catch (error) {
      console.error("Erro na autenticação WebSocket:", error);
      this.sendToClient(ws, {
        type: "auth_error",
        error: "Erro de autenticação",
      });
    }
  }

  async handleSubscribeMessages(ws, message) {
    if (!ws.userId) {
      this.sendToClient(ws, { type: "error", error: "Não autenticado" });
      return;
    }

    this.sendToClient(ws, { type: "subscribed" });
  }

  async handleSendMessage(ws, message) {
    if (!ws.userId) {
      this.sendToClient(ws, { type: "error", error: "Não autenticado" });
      return;
    }

    try {
      const mensagemService = require("./mensagemService");
      let newMessage = null;

      if (message.conversationId) {
        newMessage = await mensagemService.enviarMensagemPorConversa(
          ws.userId,
          message.conversationId,
          message.text,
          message.sourceLang,
          {
            translated: message.translated,
            type: message.messageType || "text",
            attachments: message.attachments,
          }
        );
      } else {
        const User = require("../models/User");
        const Conversation = require("../models/Conversation");
        const isRecipientAUser = await (async () => {
          try {
            const u = await User.findById(message.recipientId);
            return !!u;
          } catch (e) {
            return false;
          }
        })();

        if (!isRecipientAUser) {
          try {
            const coll = await Conversation.getCollection();
            const conv = await coll.findOne({
              _id: mongodb.getObjectId(message.recipientId),
            });
            if (conv) {
              newMessage = await mensagemService.enviarMensagemPorConversa(
                ws.userId,
                message.recipientId,
                message.text,
                message.sourceLang,
                {
                  translated: message.translated,
                  type: message.messageType || "text",
                  attachments: message.attachments,
                }
              );
            }
          } catch (e) {}
        }
        if (!newMessage) {
          newMessage = await mensagemService.enviarMensagem(
            ws.userId,
            message.recipientId,
            message.text,
            message.sourceLang,
            {
              translated: message.translated,
              type: message.messageType || "text",
              attachments: message.attachments,
            }
          );
        }
      }

      this.sendToClient(ws, {
        type: "message_sent",
        message: newMessage,
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem via WebSocket:", error);
      this.sendToClient(ws, {
        type: "error",
        error: error.message,
      });
    }
  }

  async handleMarkRead(ws, message) {
    if (!ws.userId) {
      this.sendToClient(ws, { type: "error", error: "Não autenticado" });
      return;
    }

    try {
      const mensagemService = require("./mensagemService");
      const result = await mensagemService.marcarConversaComoLida(
        ws.userId,
        message.otherUserId,
        message.untilMessageId
      );

      this.sendToClient(ws, {
        type: "messages_marked_read",
        result,
      });
    } catch (error) {
      this.sendToClient(ws, {
        type: "error",
        error: error.message,
      });
    }
  }

  handleDisconnection(ws) {
    if (ws.userId) {
      const currentWs = this.clients.get(ws.userId);
      if (currentWs === ws) {
        this.clients.delete(ws.userId);
        const activeUsers = Array.from(this.clients.keys()).filter(
          (k) => !k.includes("_subscribed")
        );
      }
    }
  }

  sendToClient(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    } else {
      console.warn(
        `WebSocket: Tentou enviar mas conexão não está aberta (readyState: ${ws.readyState})`
      );
      return false;
    }
  }

  broadcastToClients(data) {
    this.clients.forEach((ws, userId) => {
      this.sendToClient(ws, data);
    });
  }

  sendToUser(userId, data) {
    const ws = this.clients.get(userId);
    if (ws) {
      this.sendToClient(ws, data);
    }
  }

  async verifyToken(token) {
    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = require("../models/User");
      return await User.findById(decoded.userId);
    } catch (error) {
      return null;
    }
  }
}

module.exports = new WebSocketService();

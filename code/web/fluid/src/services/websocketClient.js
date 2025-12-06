class WebSocketClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageHandlers = new Map();
    this.messageQueue = [];
    this.connectionPromise = null;
  }

  async connect(token) {
    if (this.connecting) {
      return this.connectionPromise;
    }

    this.connecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = process.env.REACT_APP_WS_URL || "ws://localhost:3001/ws";

      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.connected = true;
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.processMessageQueue();
        this.send({
          type: "authenticate",
          token: token,
        });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("Erro ao processar mensagem WebSocket:", error);
        }
      };

      this.ws.onclose = (event) => {
        this.connected = false;
        this.connecting = false;

        if (event.code !== 1000) {
          this.attemptReconnect(token);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Erro WebSocket:", error);
        this.connecting = false;
        reject(error);
      };
    });

    return this.connectionPromise;
  }

  send(message) {
    if (!this.connected || !this.ws) {
      this.messageQueue.push(message);
      return false;
    }

    if (this.connecting) {
      this.messageQueue.push(message);
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket não está no estado OPEN:", this.ws.readyState);
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Erro ao enviar mensagem WebSocket:", error);
      this.messageQueue.push(message);
      return false;
    }
  }

  processMessageQueue() {
    if (this.messageQueue.length > 0) {
      const queue = [...this.messageQueue];
      this.messageQueue = [];
      queue.forEach((message) => {
        this.send(message);
      });
    }
  }

  async sendWhenReady(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const trySend = () => {
        if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
          const success = this.send(message);
          resolve(success);
        } else if (Date.now() - startTime > timeout) {
          console.error("Timeout ao aguardar WebSocket conectar");
          reject(new Error("Timeout ao aguardar WebSocket conectar"));
        } else {
          setTimeout(trySend, 100);
        }
      };
      trySend();
    });
  }

  attemptReconnect(token) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => {
        if (!this.connected && !this.connecting) {
          this.connect(token).catch(console.error);
        }
      }, delay);
    } else {
      console.error("Máximo de tentativas de reconexão atingido");
    }
  }

  handleMessage(message) {
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Erro no handler para ${message.type}:`, error);
      }
    });
  }

  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  off(messageType, handler) {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  subscribeToMessages() {
    this.sendWhenReady({ type: "subscribe_messages" })
      .then((success) => {
        if (success) {
          console.log("Inscrito para receber mensagens");
        }
      })
      .catch((error) => {
        console.error("Erro ao se inscrever para mensagens:", error);
      });
  }

  sendMessage(recipientId, text, sourceLang = null) {
    return this.sendWhenReady({
      type: "send_message",
      recipientId,
      text,
      sourceLang,
    });
  }

  sendMessageToConversation(
    conversationId,
    text,
    sourceLang = null,
    options = {}
  ) {
    return this.sendWhenReady({
      type: "send_message",
      conversationId,
      text,
      sourceLang,
      translated: options.translated,
      messageType: options.type || undefined,
      attachments: options.attachments || undefined,
    });
  }

  markMessagesAsRead(otherUserId, untilMessageId = null) {
    return this.sendWhenReady({
      type: "mark_read",
      otherUserId,
      untilMessageId,
    });
  }

  isConnected() {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState() {
    return {
      connected: this.connected,
      connecting: this.connecting,
      readyState: this.ws?.readyState,
      queueLength: this.messageQueue.length,
    };
  }

  disconnect() {
    console.log("Desconectando WebSocket...");

    if (this.ws) {
      this.ws.close(1000, "Disconnect by user");
      this.ws = null;
    }

    this.connected = false;
    this.connecting = false;
    this.messageQueue = [];
    this.messageHandlers.clear();
    this.connectionPromise = null;
  }
}

export default new WebSocketClient();

const amqp = require("amqplib");
require("dotenv").config();

class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.connected = false;
    this.subscribers = new Map();
    this.url = process.env.RABBITMQ_URL;
  }

  async connect() {
    if (this.connected) return;

    try {
      console.log("Conectando ao CloudAMQP...");

      const connectionOptions = {
        heartbeat: 60,
      };

      this.connection = await amqp.connect(this.url, connectionOptions);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange("chat_messages", "topic", {
        durable: true,
      });

      await this.channel.assertQueue("chat_notifications", "fanout", {
        durable: true,
      });

      await this.channel.assertQueue("chat_notifications_queue", {
        durable: true,
      });

      await this.channel.bindQueue(
        "chat_notifications_queue",
        "chat_notifications",
        ""
      );

      this.connected = true;
      console.log("Conectado ao CloudAMQP");

      this.connection.on("error", (err) => {
        console.error("CloudAMQP connection error:", err);
        this.connected = false;
        this.reconnect();
      });

      this.connection.on("close", () => {
        console.log("RabbitMQ connection closed");
        this.connected = false;
        this.reconnect();
      });

      this.consumeNotifications();
    } catch (error) {
      console.error("Erro ao conectar ao CloudAMQP:", error);
      this.reconnect();
      throw error;
    }
  }

  async reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;

    console.log("Attempting to reconnect to CloudAMQP in 5 seconds...");

    setTimeout(async () => {
      try {
        await this.connect();
        this.reconnecting = false;
      } catch (err) {
        console.error("Reconnection failed:", err);
        this.reconnecting = false;
        this.reconnect();
      }
    }, 5000);
  }

  async publishMessage(message) {
    try {
      await this.connect();

      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString(),
      };

      const messageBuffer = Buffer.from(JSON.stringify(messageWithTimestamp));

      const routingKey = `message.${message.recipientId}`;

      await this.channel.publish("chat_messages", routingKey, messageBuffer, {
        persistent: true,
        contentType: "application/json",
      });

      if (message.type === "notification" || message.type === "new_message") {
        await this.channel.publish("chat_notifications", "", messageBuffer, {
          persistent: true,
          contentType: "application/json",
        });
      }

      return true;
    } catch (error) {
      console.error("Error publishing message:", error);
      throw error;
    }
  }

  async subscribeToUserMessages(userId, callback) {
    await this.connect();

    const queueName = `user_${userId}_messages`;

    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        // Auto-delete after 24 hours of inactivity
        "x-expires": 24 * 60 * 60 * 1000,
      },
    });

    const routingKey = `message.${userId}`;
    await this.channel.bindQueue(queueName, "chat_messages", routingKey);

    await this.channel.prefetch(10);

    this.channel.consume(
      queueName,
      (msg) => {
        if (msg !== null) {
          try {
            const message = JSON.parse(msg.content.toString());
            callback(message);
            this.channel.ack(msg);
          } catch (error) {
            console.error("Error processing message:", error);
            this.channel.nack(msg, false, false);
          }
        }
      },
      {
        noAck: false,
      }
    );

    console.log(`Subscribed to messages for user ${userId}`);
  }

  async consumeNotifications() {
    await this.channel.consume(
      "chat_notifications_queue",
      (msg) => {
        if (msg !== null) {
          try {
            const notification = JSON.parse(msg.content.toString());
            this.broadcastToSubscribers("notification", notification);
            this.channel.ack(msg);
          } catch (error) {
            console.error("Error processing notification:", error);
            this.channel.nack(msg, false, false);
          }
        }
      },
      {
        noAck: false,
      }
    );
  }

  addSubscriber(type, callback) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type).add(callback);
  }

  broadcastToSubscribers(type, data) {
    const callbacks = this.subscribers.get(type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (error) {
      console.error("Error closing RabbitMQ connection:", error);
    } finally {
      this.connected = false;
      console.log("CloudAMQP connection closed");
    }
  }
}

module.exports = new RabbitMQService();

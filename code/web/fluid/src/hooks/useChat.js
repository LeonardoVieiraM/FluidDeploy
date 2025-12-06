import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import websocketClient from "../services/websocketClient";
import apiService from "../services/apiService";

export const useChat = () => {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadUserContacts = useCallback(async () => {
    if (!user) return;

    try {
      const result = await apiService.getContacts();
      if (result.success) {
        return result.data || [];
      } else {
        throw new Error(result.error || "Erro ao carregar contatos");
      }
    } catch (err) {
      console.error("Erro ao carregar contatos:", err);
      throw err;
    }
  }, [user]);

  const addContact = useCallback(
    async (contactId, apelido = null) => {
      if (!user) return;

      setError(null);
      try {
        const result = await apiService.addContact(contactId, apelido);

        if (result.success) {
          await loadConversations();
          return result.data;
        } else {
          throw new Error(result.error || "Erro ao adicionar contato");
        }
      } catch (err) {
        console.error("Erro ao adicionar contato:", err);
        setError(err.message || "Erro ao adicionar contato");
        throw err;
      }
    },
    [user]
  );

  const traceSetMessages = useCallback((payload, origin = "unknown") => {
    try {
      const ts = new Date().toISOString();
      if (typeof payload === "function") {
        setMessages((prev) => {
          const result = payload(prev);
          return result;
        });
      } else {
        setMessages(payload);
      }
    } catch (e) {
      console.warn("traceSetMessages failed", e);
      setMessages(payload);
    }
  }, []);

  const debugDump = useCallback((label, obj) => {
    try {
      const s = JSON.stringify(obj, null, 2);
      const out = s.length > 1200 ? s.slice(0, 1200) + "... [truncated]" : s;
      console.log(new Date().toISOString(), label, out);
    } catch (e) {
      console.log(new Date().toISOString(), label, obj);
    }
  }, []);

  const translateMessageForUser = useCallback(
    async (message, targetLanguage) => {
      if (!message || !targetLanguage) return message;

      try {
        const isSent = message.senderId?.toString() === user?.id?.toString();
        const isGroup =
          activeConversation?.type === "group" ||
          activeConversation?.otherUser?.isGroup;

        if (isGroup && isSent) {
          return message;
        }

        const sourceLang = message.sourceLang || message.senderLanguage;
        const originalText = message.originalText || message.text || "";

        if (!originalText.trim() || sourceLang === targetLanguage) {
          return message;
        }

        if (message.translatedText && message.translatedText !== originalText) {
          return message;
        }

        if (message.type === "image") {
          return message;
        }

        const result = await apiService.translateText(
          originalText,
          sourceLang,
          targetLanguage
        );

        if (result.success && result.data && result.data.translatedText) {
          return {
            ...message,
            translatedText: result.data.translatedText,
            sourceLang: sourceLang,
            targetLang: targetLanguage,
            clientTranslated: true,
          };
        }
      } catch (error) {
        console.error("Error translating message:", error);
      }

      return message;
    },
    [user, activeConversation]
  );

  const normalizeRawMessage = useCallback((m) => {
    if (!m || typeof m !== "object") return m;

    const norm = { ...m };

    try {
      const extractValue = (v) => {
        if (v == null) return v;
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        )
          return v;
        if (typeof v === "object") {
          if (v.$oid) return v.$oid;
          if (v._id && v._id.$oid) return v._id.$oid;
          if (v.id && v.id.$oid) return v.id.$oid;

          if (v.$date) {
            if (typeof v.$date === "string") return v.$date;
            if (v.$date && v.$date.$numberLong)
              return new Date(Number(v.$date.$numberLong)).toISOString();
          }

          if (v._id) return extractValue(v._id);
          if (v.id) return extractValue(v.id);

          if (v.toString && typeof v.toString === "function") {
            try {
              return v.toString();
            } catch (e) {
              return v;
            }
          }
        }
        return v;
      };

      if (!norm.id) {
        if (norm._id) norm.id = extractValue(norm._id);
        else if (norm.messageId) norm.id = extractValue(norm.messageId);
        else if (norm.mid) norm.id = extractValue(norm.mid);
      }

      if (norm.id && typeof norm.id !== "string") {
        norm.id = String(extractValue(norm.id));
      }

      if (!norm.senderId) {
        norm.senderId =
          norm.from ||
          norm.author ||
          norm.userId ||
          norm.owner ||
          norm.createdBy ||
          null;
      }
      if (norm.senderId && typeof norm.senderId !== "string") {
        norm.senderId = String(extractValue(norm.senderId));
      }

      if (norm.conversationId && typeof norm.conversationId !== "string") {
        norm.conversationId = String(extractValue(norm.conversationId));
      }

      if (Array.isArray(norm.recipientIds)) {
        norm.recipientIds = norm.recipientIds.map((id) =>
          typeof id === "string" ? id : String(extractValue(id))
        );
      }

      if (!norm.originalText && (norm.text || norm.content)) {
        norm.originalText = norm.text || norm.content;
      }
      if (
        !norm.translatedText &&
        (norm.translation || norm.translated_content)
      ) {
        norm.translatedText = norm.translation || norm.translated_content;
      }

      if (norm.createdAt && !(typeof norm.createdAt === "string")) {
        norm.createdAt = extractValue(norm.createdAt);
        if (norm.createdAt && !(typeof norm.createdAt === "string")) {
          try {
            norm.createdAt = new Date(norm.createdAt).toISOString();
          } catch (e) {}
        }
      }

      if (norm.attachments && !Array.isArray(norm.attachments)) {
        norm.attachments = [norm.attachments];
      }
      if (!norm.attachments) norm.attachments = [];
    } catch (e) {
      console.warn("normalizeRawMessage failed", e, m);
    }

    return norm;
  }, []);

  const getDeletedMap = useCallback(() => {
    try {
      const raw = localStorage.getItem("fluid_deleted_conversations");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }, []);

  const setDeletedAtFor = useCallback(
    (convId, iso) => {
      try {
        const map = getDeletedMap();
        map[String(convId)] = iso;
        localStorage.setItem(
          "fluid_deleted_conversations",
          JSON.stringify(map)
        );
      } catch (e) {
        console.warn("setDeletedAtFor failed", e);
      }
    },
    [getDeletedMap]
  );

  const setDeletedAtForBoth = useCallback(
    (convId, otherUserId, iso) => {
      try {
        if (convId) setDeletedAtFor(convId, iso);
        if (otherUserId) setDeletedAtFor(otherUserId, iso);
      } catch (e) {
        console.warn("setDeletedAtForBoth failed", e);
      }
    },
    [setDeletedAtFor]
  );

  const enrichMessagesWithSenderInfo = useCallback(
    async (messagesArray) => {
      if (!messagesArray || !messagesArray.length) return messagesArray;

      try {
        const senderIds = [
          ...new Set(
            messagesArray.map((msg) => msg.senderId?.toString()).filter(Boolean)
          ),
        ];

        if (senderIds.length === 0) return messagesArray;
        const senderPromises = senderIds.map(async (senderId) => {
          try {
            let userData = null;

            const currentUserId = user?.id?.toString();
            if (senderId === currentUserId) {
              userData = user;
            } else {
              const result = await apiService.searchUsers(senderId, 1);
              if (result.success && result.data && result.data.length > 0) {
                userData = result.data[0];
              } else {
                console.warn(
                  `User not found via search, senderId: ${senderId}`
                );
              }
            }

            if (userData) {
              const nome =
                userData.nome ||
                userData.name ||
                userData.apelido ||
                userData.email ||
                null;

              if (!nome) {
                console.warn(
                  `Usuário encontrado mas sem nome: senderId=${senderId}`
                );
              }

              return {
                id: senderId,
                user: {
                  nome: nome,
                  imagemPerfil:
                    userData.imagemPerfil ||
                    userData.avatarUrl ||
                    userData.fotoPerfil ||
                    null,
                },
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch user ${senderId}:`, error);
          }
          return null;
        });

        const senderResults = await Promise.all(senderPromises);
        const senderMap = new Map();

        senderResults.forEach((result) => {
          if (result && result.user) {
            senderMap.set(result.id, result.user);
          }
        });

        const enriched = messagesArray.map((msg) => {
          const senderId = msg.senderId?.toString();

          if (msg.senderName) {
            return {
              ...msg,
              senderName: msg.senderName,
              senderImagemPerfil: msg.senderImagemPerfil || null,
            };
          }

          if (senderId && senderMap.has(senderId)) {
            const sender = senderMap.get(senderId);
            const enrichedMsg = {
              ...msg,
              senderName: sender.nome,
              senderImagemPerfil: sender.imagemPerfil || msg.senderImagemPerfil,
            };
            return enrichedMsg;
          }

          const guessedName =
            msg.senderName ||
            msg.senderNome ||
            (msg.sender && (msg.sender.nome || msg.sender.name));

          const guessedAvatar =
            msg.senderImagemPerfil ||
            (msg.sender &&
              (msg.sender.imagemPerfil ||
                msg.sender.avatarUrl ||
                msg.sender.fotoPerfil));

          console.warn(
            `Mensagem ${msg.id}: senderId=${senderId}, guessedName="${
              guessedName || "Usuário"
            }", senderName no msg="${msg.senderName}"`
          );

          return {
            ...msg,
            senderName: guessedName || "Usuário",
            senderImagemPerfil: guessedAvatar || null,
          };
        });

        return enriched;
      } catch (error) {
        console.error("Error enriching messages with sender info:", error);
        return messagesArray.map((msg) => {
          const guessedName =
            msg.senderName ||
            msg.senderNome ||
            (msg.sender && (msg.sender.nome || msg.sender.name));
          const guessedAvatar =
            msg.senderImagemPerfil ||
            (msg.sender &&
              (msg.sender.imagemPerfil ||
                msg.sender.avatarUrl ||
                msg.sender.fotoPerfil));
          return {
            ...msg,
            senderName: guessedName || "Usuário",
            senderImagemPerfil: guessedAvatar || null,
          };
        });
      }
    },
    [user]
  );

  const handleNewMessage = useCallback(
    async (data) => {
      try {
        let newMessage = normalizeRawMessage(data.message);
        try {
          const enrichedArr = await enrichMessagesWithSenderInfo([newMessage]);
          if (enrichedArr && enrichedArr[0]) {
            newMessage = enrichedArr[0];
          }
        } catch (enrichErr) {
          console.warn(
            "Failed to enrich new WS message with sender info:",
            enrichErr
          );
        }

        const currentUserId = user?.id?.toString();
        const messageSenderId = newMessage.senderId?.toString();
        const messageRecipientIds = Array.isArray(newMessage.recipientIds)
          ? newMessage.recipientIds.map((r) => String(r))
          : newMessage.recipientId
          ? [String(newMessage.recipientId)]
          : [];
        const messageRecipientId = messageRecipientIds.length
          ? messageRecipientIds[0]
          : null;
        const activeOtherUserId = activeConversation?.otherUser?.id?.toString();
        try {
          const deletedMap = getDeletedMap();
          let otherId = null;
          if (
            messageSenderId &&
            currentUserId &&
            messageSenderId !== currentUserId
          )
            otherId = messageSenderId;
          else if (messageRecipientIds && currentUserId) {
            const others = messageRecipientIds.filter(
              (r) => r && r !== currentUserId
            );
            if (others.length) otherId = others[0];
          }

          const candKeys = [];
          if (newMessage.conversationId)
            candKeys.push(String(newMessage.conversationId));
          if (otherId) candKeys.push(String(otherId));

          for (const k of candKeys) {
            const delIso = deletedMap && deletedMap[String(k)];
            if (delIso) {
              try {
                const cutoff = new Date(delIso);
                const created = newMessage.createdAt
                  ? new Date(newMessage.createdAt)
                  : newMessage._createdAt
                  ? new Date(newMessage._createdAt)
                  : null;
                if (created && created <= cutoff) {
                  return;
                }
              } catch (e) {}
            }
          }
        } catch (e) {}

        const messageConversationId = newMessage.conversationId
          ? newMessage.conversationId.toString()
          : null;
        if (
          activeConversation &&
          ((messageConversationId &&
            messageConversationId === activeConversation.id) ||
            messageSenderId === activeOtherUserId ||
            (messageRecipientIds &&
              activeOtherUserId &&
              messageRecipientIds.includes(activeOtherUserId)) ||
            messageSenderId === currentUserId)
        ) {
          traceSetMessages((prev) => {
            const exists = prev.some(
              (msg) =>
                (msg.id &&
                  newMessage.id &&
                  String(msg.id) === String(newMessage.id)) ||
                (msg.createdAt === newMessage.createdAt &&
                  String(msg.senderId) === messageSenderId)
            );
            if (exists) return prev;

            const updated = [...prev, normalizeRawMessage(newMessage)]
              .map(normalizeRawMessage)
              .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            return updated;
          }, "handleNewMessage");
        }

        if (newMessage.conversationId) {
          const convKey = newMessage.conversationId.toString();
          setUnreadCounts((prev) => ({
            ...prev,
            [convKey]: (prev[convKey] || 0) + 1,
          }));
        } else if (
          Array.isArray(newMessage.recipientIds) &&
          newMessage.recipientIds.includes(user?.id)
        ) {
          setUnreadCounts((prev) => ({
            ...prev,
            [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1,
          }));
        }

        setConversations((prev) => {
          let found = false;
          const mapped = prev.map((conv) => {
            const convId = conv.otherUser?.id?.toString();
            if (
              convId === String(newMessage.senderId) ||
              (Array.isArray(newMessage.recipientIds) &&
                convId &&
                newMessage.recipientIds.includes(convId)) ||
              (newMessage.conversationId &&
                convId === newMessage.conversationId.toString()) ||
              convId === String(newMessage.recipientId)
            ) {
              found = true;
              return { ...conv, lastMessage: newMessage };
            }
            return conv;
          });

          if (!found) {
            try {
              const currentUserId = user?.id?.toString();
              const hasConversationId = !!newMessage.conversationId;
              const rids = Array.isArray(newMessage.recipientIds)
                ? newMessage.recipientIds.map((r) => String(r))
                : newMessage.recipientId
                ? [String(newMessage.recipientId)]
                : [];
              const otherParticipants = rids.filter(
                (r) => r && r !== currentUserId
              );

              let newConv = null;
              if (otherParticipants.length > 1) {
                newConv = {
                  id: hasConversationId
                    ? String(newMessage.conversationId)
                    : newMessage.conversationId
                    ? String(newMessage.conversationId)
                    : null,
                  type: "group",
                  participants: [],
                  otherUser: {
                    id: hasConversationId
                      ? String(newMessage.conversationId)
                      : newMessage.conversationId
                      ? String(newMessage.conversationId)
                      : null,
                    nome: "Grupo",
                    status: "group",
                    imagemPerfil: null,
                    isGroup: true,
                  },
                  lastMessage: newMessage,
                  unreadCount: 1,
                  config: {
                    arquivada: false,
                    fixada: false,
                    silenciada: false,
                  },
                };
              } else {
                let otherId = null;
                if (
                  newMessage.senderId &&
                  String(newMessage.senderId) !== currentUserId
                ) {
                  otherId = String(newMessage.senderId);
                } else if (otherParticipants.length === 1) {
                  otherId = otherParticipants[0];
                }

                newConv = {
                  id: newMessage.conversationId
                    ? String(newMessage.conversationId)
                    : null,
                  type: "direct",
                  participants: [],
                  otherUser: {
                    id:
                      otherId ||
                      (newMessage.conversationId
                        ? String(newMessage.conversationId)
                        : null),

                    nome:
                      newMessage.senderName ||
                      newMessage.sender_name ||
                      newMessage.sender?.nome ||
                      newMessage.sender?.name ||
                      newMessage.sender?.username ||
                      "Usuário",

                    status: "offline",

                    imagemPerfil:
                      newMessage.senderAvatar ||
                      newMessage.sender_avatar ||
                      newMessage.sender?.imagemPerfil ||
                      null,

                    isGroup: false,
                  },
                  lastMessage: newMessage,
                  unreadCount: 1,
                  config: {
                    arquivada: false,
                    fixada: false,
                    silenciada: false,
                  },
                };
              }

              if (newConv) mapped.push(newConv);
            } catch (e) {
              console.warn(
                "Falha ao criar conversa a partir de nova mensagem:",
                e?.message || e
              );
            }
          }

          return mapped.sort((a, b) => {
            const aDate = a.lastMessage
              ? new Date(a.lastMessage.createdAt)
              : new Date(0);
            const bDate = b.lastMessage
              ? new Date(b.lastMessage.createdAt)
              : new Date(0);
            return bDate - aDate;
          });
        });
      } catch (err) {
        console.error("Erro ao processar nova mensagem:", err);
      }
    },
    [
      activeConversation,
      user,
      getDeletedMap,
      traceSetMessages,
      enrichMessagesWithSenderInfo,
    ]
  );
  const handleMessageSent = useCallback((data) => {
    try {
      const sentMessage = normalizeRawMessage(data.message);
      traceSetMessages((prev) => {
        const exists = prev.some(
          (msg) =>
            (msg.id &&
              sentMessage.id &&
              String(msg.id) === String(sentMessage.id)) ||
            (msg.createdAt === sentMessage.createdAt &&
              String(msg.senderId) === String(sentMessage.senderId))
        );
        if (exists) {
          return prev;
        }

        const updated = [...prev, sentMessage]
          .map(normalizeRawMessage)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return updated;
      }, "handleMessageSent");

      setConversations((prev) =>
        prev
          .map((conv) => {
            const convId = conv.otherUser?.id?.toString();
            if (
              (sentMessage.conversationId &&
                convId === sentMessage.conversationId.toString()) ||
              (Array.isArray(sentMessage.recipientIds) &&
                convId &&
                sentMessage.recipientIds.includes(convId)) ||
              conv.otherUser?.id === sentMessage.recipientId
            ) {
              return { ...conv, lastMessage: sentMessage };
            }
            return conv;
          })
          .sort((a, b) => {
            const aDate = a.lastMessage
              ? new Date(a.lastMessage.createdAt)
              : new Date(0);
            const bDate = b.lastMessage
              ? new Date(b.lastMessage.createdAt)
              : new Date(0);
            return bDate - aDate;
          })
      );
    } catch (error) {
      console.error("Erro ao processar mensagem enviada:", error);
    }
  }, []);

  useEffect(() => {
    if (!user || !token) return;

    const initializeWebSocket = async () => {
      try {
        await websocketClient.connect(token);

        websocketClient.on("new_message", handleNewMessage);
        websocketClient.on("message_sent", handleMessageSent);
        websocketClient.subscribeToMessages();
      } catch (err) {
        console.error("Erro ao inicializar WebSocket:", err);
      }
    };

    initializeWebSocket();

    return () => {
      websocketClient.off("new_message", handleNewMessage);
      websocketClient.off("message_sent", handleMessageSent);
    };
  }, [user, token, handleNewMessage, handleMessageSent]);

  const loadConversations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const result = await apiService.getConversations();

      if (result.success) {
        console.log(
          "useChat.loadConversations - raw API data:",
          result.data && result.data.length ? result.data[0] : result.data
        );
        const deletedMap = getDeletedMap();
        const filtered = (result.data || []).filter((conv) => {
          try {
            const convId =
              conv.id ||
              conv._id ||
              (conv.otherUser && (conv.otherUser.id || conv.otherUser._id));
            if (!convId) return false;
            const del = deletedMap[String(convId)];
            if (!del) return true; // not deleted locally
            const lastCreated = conv.lastMessage
              ? new Date(conv.lastMessage.createdAt)
              : null;
            if (lastCreated && lastCreated > new Date(del)) return true;
            return false;
          } catch (e) {
            return true;
          }
        });
        const sortedConversations = (filtered || []).sort((a, b) => {
          const aDate = a.lastMessage
            ? new Date(a.lastMessage.createdAt)
            : new Date(0);
          const bDate = b.lastMessage
            ? new Date(b.lastMessage.createdAt)
            : new Date(0);
          return bDate - aDate;
        });

        setConversations(sortedConversations);

        const counts = {};
        (result.data || []).forEach((conv) => {
          if (conv.otherUser?.id) {
            counts[conv.otherUser.id] = conv.unreadCount || 0;
          }
        });
        setUnreadCounts(counts);
      } else {
        throw new Error(result.error || "Erro ao carregar conversas");
      }
    } catch (err) {
      console.error("Erro ao carregar conversas:", err);
      setError(err.message || "Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMessages = useCallback(
    async (conversationOrOther) => {
      if (!user || !conversationOrOther) return;

      setLoading(true);
      setError(null);
      try {
        let result;

        const isGroupConversation =
          typeof conversationOrOther === "object" &&
          (conversationOrOther.type === "group" ||
            conversationOrOther.otherUser?.isGroup);

        if (isGroupConversation && conversationOrOther.id) {
          result = await apiService.getMessagesByConversation(
            conversationOrOther.id
          );
        } else if (
          typeof conversationOrOther === "object" &&
          conversationOrOther.id
        ) {
          result = await apiService.getMessagesByConversation(
            conversationOrOther.id
          );
        } else {
          const otherUserId =
            typeof conversationOrOther === "object"
              ? conversationOrOther.otherUser?.id
              : conversationOrOther;
          result = await apiService.getConversation(otherUserId);
        }

        if (!result.success) {
          throw new Error(result.error || "Erro ao carregar mensagens");
        }

        let messagesArray = [];
        let serverConversationMeta = null;

        if (result.data?.messages && Array.isArray(result.data.messages)) {
          messagesArray = result.data.messages || [];
          serverConversationMeta = result.data.conversation || null;
        } else if (Array.isArray(result.data)) {
          messagesArray = result.data;
        } else if (result.data && typeof result.data === "object") {
          if (Array.isArray(result.data.data?.messages)) {
            messagesArray = result.data.data.messages;
            serverConversationMeta = result.data.data.conversation || null;
          } else if (Array.isArray(result.data.data)) {
            messagesArray = result.data.data;
          } else {
            console.warn(
              "UNEXPECTED API STRUCTURE - trying to use result.data directly"
            );
            messagesArray = result.data.messages || result.data.data || [];
          }
        } else {
          console.warn("UNEXPECTED API STRUCTURE - no messages array found");
          messagesArray = [];
        }
        messagesArray = messagesArray.filter(
          (msg) => msg && typeof msg === "object"
        );

        try {
          const currentUserId =
            user && (user.id || user._id) ? String(user.id || user._id) : null;
          if (serverConversationMeta && currentUserId) {
            const pMeta =
              serverConversationMeta.participantsMeta ||
              serverConversationMeta.participants_meta ||
              serverConversationMeta.participantsMeta ||
              [];
            const myMeta = Array.isArray(pMeta)
              ? pMeta.find(
                  (pm) =>
                    String(pm.userId) === currentUserId ||
                    String(pm.userId) === currentUserId
                )
              : null;
            let cutoff = null;
            if (myMeta) {
              if (myMeta.clearedBefore) cutoff = myMeta.clearedBefore;
              if (myMeta.deletedAt) cutoff = myMeta.deletedAt;
            }
            if (cutoff) {
              const cutoffDate = new Date(cutoff);
              const beforeCount = messagesArray.length;
              messagesArray = (messagesArray || []).filter((m) => {
                try {
                  const rawCreated =
                    m.createdAt ??
                    m.timestamp ??
                    m.created_at ??
                    m.created ??
                    m._createdAt;
                  const created = rawCreated ? new Date(rawCreated) : null;
                  if (!created || !isFinite(created.getTime())) return true;
                  return created > cutoffDate;
                } catch {
                  return false;
                }
              });
            }
          }
        } catch (e) {
          console.warn("Falha ao aplicar cutoff por usuário:", e?.message || e);
        }

        try {
          const deletedMap = getDeletedMap();
          const convKey =
            typeof conversationOrOther === "object" &&
            (conversationOrOther.id || conversationOrOther._id)
              ? conversationOrOther.id || conversationOrOther._id
              : typeof conversationOrOther === "object" &&
                conversationOrOther.otherUser
              ? conversationOrOther.otherUser.id
              : conversationOrOther;

          if (convKey && deletedMap && deletedMap[String(convKey)]) {
            const cutoff = new Date(deletedMap[String(convKey)]);
            const before = messagesArray.length;
            messagesArray = (messagesArray || []).filter((m) => {
              try {
                const rawCreated =
                  m.createdAt ??
                  m.timestamp ??
                  m.created_at ??
                  m.created ??
                  m._createdAt;
                const created = rawCreated ? new Date(rawCreated) : null;
                if (!created || !isFinite(created.getTime())) return true;
                return created > cutoff;
              } catch {
                return false;
              }
            });
          }
        } catch {}

        if (messagesArray.length > 0) {
          const rawMessage = messagesArray[0];
        }

        const normalizedCandidates = (messagesArray || []).map((m) =>
          normalizeRawMessage(m)
        );

        let enrichedMessages = normalizedCandidates;
        if (normalizedCandidates.length > 0) {
          try {
            enrichedMessages = await enrichMessagesWithSenderInfo(
              normalizedCandidates
            );
          } catch (enrichError) {
            console.warn(
              "Failed to enrich messages with sender info:",
              enrichError
            );
          }
        }

        let filtered = enrichedMessages;

        const isGroupConversationFromData =
          (serverConversationMeta && serverConversationMeta.type === "group") ||
          (typeof conversationOrOther === "object" &&
            (conversationOrOther.type === "group" ||
              conversationOrOther.otherUser?.isGroup)) ||
          false;

        normalizedCandidates.forEach((m, idx) => {
          const hasId = !!(m.id || m._id);
          const hasContent = !!(
            m.originalText ||
            m.translatedText ||
            m.text ||
            m.content
          );
          const hasAttachments = !!(
            m.attachments &&
            Array.isArray(m.attachments) &&
            m.attachments.length > 0
          );
          const hasSender = !!m.senderId;
          const hasConversation = !!m.conversationId;
        });

        let finalMessages = filtered;

        if (isGroupConversationFromData && user?.idiomaPadrao) {
          const targetLanguage = user.idiomaPadrao;
          try {
            finalMessages = await Promise.all(
              filtered.map((msg) =>
                translateMessageForUser(msg, targetLanguage)
              )
            );
          } catch (translationError) {
            console.warn(
              "Failed to translate group messages on load:",
              translationError?.message || translationError
            );
            finalMessages = filtered;
          }
        }

        const sortedMessages = finalMessages.sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );

        traceSetMessages(sortedMessages, "loadMessages");

        try {
          if (
            typeof conversationOrOther === "object" &&
            conversationOrOther.id
          ) {
            await apiService.markConversationAsReadByConversation(
              conversationOrOther.id
            );
            setUnreadCounts((prev) => ({
              ...prev,
              [conversationOrOther.id]: 0,
            }));
          } else {
            const otherUserId =
              typeof conversationOrOther === "object" &&
              conversationOrOther.otherUser
                ? conversationOrOther.otherUser.id
                : conversationOrOther;
            if (otherUserId) {
              await apiService.markConversationAsRead(otherUserId);
              setUnreadCounts((prev) => ({ ...prev, [otherUserId]: 0 }));
            }
          }
        } catch (readError) {
          console.warn("Erro ao marcar mensagens como lidas:", readError);
        }
      } catch (err) {
        console.error("Erro ao carregar mensagens:", err);
        setError(err.message || "Erro ao carregar mensagens");
      } finally {
        setLoading(false);
      }
    },
    [
      user,
      translateMessageForUser,
      getDeletedMap,
      enrichMessagesWithSenderInfo,
      normalizeRawMessage,
    ]
  );
  const sendMessage = useCallback(
    async (recipientId, text) => {
      if (!user || !recipientId || !text?.trim()) {
        throw new Error("Dados inválidos para enviar mensagem");
      }

      setError(null);
      try {
        if (!websocketClient.isConnected()) {
          try {
            await websocketClient.connect(token);
          } catch (reconnectError) {
            console.error("Falha ao reconectar WebSocket:", reconnectError);
          }
        }

        let success = false;

        if (activeConversation?.id) {
          success = await websocketClient.sendMessageToConversation(
            activeConversation.id,
            text.trim()
          );
        } else {
          success = await websocketClient.sendMessage(recipientId, text.trim());
        }

        if (!success) {
          let result;
          if (activeConversation?.id) {
            result = await apiService.sendMessageToConversation(
              activeConversation.id,
              text.trim(),
              user.idiomaPadrao || "en-US"
            );
          } else {
            result = await apiService.sendMessage(recipientId, text.trim());
          }

          if (result.success) {
            const newMessage = result.data;

            traceSetMessages((prev) => {
              const updated = [...prev, newMessage].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
              );
              return updated;
            }, "sendMessage-fallback");

            setConversations((prev) =>
              prev
                .map((conv) => {
                  const convOtherId = conv.otherUser?.id;
                  const matchByRecipientIds =
                    Array.isArray(newMessage.recipientIds) &&
                    convOtherId &&
                    newMessage.recipientIds.includes(convOtherId);
                  const matchByConversation =
                    newMessage.conversationId &&
                    convOtherId === newMessage.conversationId;
                  if (
                    convOtherId === recipientId ||
                    matchByRecipientIds ||
                    matchByConversation
                  ) {
                    return { ...conv, lastMessage: newMessage };
                  }
                  return conv;
                })
                .sort((a, b) => {
                  const aDate = a.lastMessage
                    ? new Date(a.lastMessage.createdAt)
                    : new Date(0);
                  const bDate = b.lastMessage
                    ? new Date(b.lastMessage.createdAt)
                    : new Date(0);
                  return bDate - aDate;
                })
            );

            return newMessage;
          } else {
            throw new Error(result.error || "Erro ao enviar mensagem");
          }
        }
      } catch (err) {
        console.error("Erro ao enviar mensagem:", err);
        setError(err.message || "Erro ao enviar mensagem");
        throw err;
      }
    },
    [user, activeConversation, token, traceSetMessages]
  );

  const sendImageMessage = async (recipientId, file, caption = "") => {
    if (!user || !recipientId || !file) {
      throw new Error("Dados inválidos para enviar imagem");
    }

    const up = await apiService.uploadChatImage(file);
    if (!up?.success) {
      throw new Error(up?.error || "Falha no upload da imagem");
    }

    const sent = await apiService.sendImageMessage(
      recipientId,
      up,
      caption || ""
    );

    if (!sent?.success) {
      throw new Error(sent?.error || "Falha ao enviar mensagem de imagem");
    }

    const newMsg = sent.data;
    traceSetMessages(
      (prev) =>
        [...prev, newMsg].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        ),
      "sendImageMessage"
    );
    setConversations((prev) =>
      prev
        .map((conv) => {
          const convOtherId = conv.otherUser?.id;
          const matchByRecipientIds =
            Array.isArray(newMsg.recipientIds) &&
            convOtherId &&
            newMsg.recipientIds.includes(convOtherId);
          const matchByConversation =
            newMsg.conversationId && convOtherId === newMsg.conversationId;
          if (
            convOtherId === recipientId ||
            matchByRecipientIds ||
            matchByConversation
          )
            return { ...conv, lastMessage: newMsg };
          return conv;
        })
        .sort((a, b) => {
          const aDate = a.lastMessage
            ? new Date(a.lastMessage.createdAt)
            : new Date(0);
          const bDate = b.lastMessage
            ? new Date(b.lastMessage.createdAt)
            : new Date(0);
          return bDate - aDate;
        })
    );
    return newMsg;
  };

  const deleteConversation = useCallback(
    async (otherUserId) => {
      if (!user || !otherUserId) return;

      setError(null);
      try {
        const apiService = (await import("../services/apiService")).default;
        const result = await apiService.deleteConversation(otherUserId);

        if (result.success) {
          try {
            const conv = (conversations || []).find(
              (c) =>
                String(c.otherUser?.id) === String(otherUserId) ||
                String(c.id) === String(otherUserId)
            );
            const convId =
              conv && (conv.id || conv._id) ? conv.id || conv._id : otherUserId;
            setDeletedAtForBoth(convId, otherUserId, new Date().toISOString());
          } catch (e) {
            console.warn(
              "could not persist deleted timestamp for",
              otherUserId,
              e
            );
          }

          setConversations((prev) =>
            prev.filter((conv) => conv.otherUser.id !== otherUserId)
          );

          if (activeConversation?.otherUser.id === otherUserId) {
            setActiveConversation(null);
            traceSetMessages([], "deleteConversation");
            try {
              const stored = localStorage.getItem("fluid_active_conversation");
              if (
                stored &&
                (String(stored) === String(otherUserId) ||
                  String(stored) === `u:${otherUserId}` ||
                  String(stored) === `c:${otherUserId}`)
              ) {
                localStorage.removeItem("fluid_active_conversation");
              }
            } catch (e) {
              console.warn(
                "Falha ao remover fluid_active_conversation do localStorage após deleteConversation:",
                e?.message || e
              );
            }
          }

          return result.data;
        } else {
          const isNotFound =
            result.status === 404 ||
            String(result.error || "")
              .toLowerCase()
              .includes("conversa não encontrada");
          if (isNotFound) {
            try {
              const conv = (conversations || []).find(
                (c) =>
                  String(c.otherUser?.id) === String(otherUserId) ||
                  String(c.id) === String(otherUserId)
              );
              const convId =
                conv && (conv.id || conv._id)
                  ? conv.id || conv._id
                  : otherUserId;
              setDeletedAtForBoth(
                convId,
                otherUserId,
                new Date().toISOString()
              );
            } catch (e) {}
            setConversations((prev) =>
              prev.filter((conv) => conv.otherUser.id !== otherUserId)
            );
            if (activeConversation?.otherUser.id === otherUserId) {
              setActiveConversation(null);
              traceSetMessages([], "deleteConversation-notfound");
            }
            try {
              localStorage.removeItem("fluid_active_conversation");
            } catch (e) {}
            return {
              success: true,
              data: null,
              note: "deleted locally (server returned not found)",
            };
          }
          throw new Error(result.error || "Erro ao excluir conversa");
        }
      } catch (err) {
        console.error("Erro ao excluir conversa:", err);
        setError(err.message || "Erro ao excluir conversa");
        throw err;
      }
    },
    [user, activeConversation]
  );

  const selectConversation = useCallback(
    (conversation) => {
      if (!conversation?.otherUser?.id) {
        console.error("Conversa inválida:", conversation);
        return;
      }

      setActiveConversation(conversation);
      try {
        const isDirect =
          conversation.type === "direct" ||
          (conversation.otherUser && !conversation.otherUser.isGroup);
        const key = isDirect
          ? `u:${conversation.otherUser.id}`
          : conversation.id
          ? `c:${conversation.id}`
          : `u:${conversation.otherUser.id}`;
        if (key) {
          try {
            localStorage.setItem("fluid_active_conversation", String(key));
          } catch (e) {
            console.warn(
              "Não foi possível salvar active conversation no localStorage:",
              e?.message
            );
          }
        }
      } catch (e) {
        console.warn(
          "Não foi possível salvar active conversation no localStorage:",
          e?.message
        );
      }
      try {
        traceSetMessages([], "selectConversation-clear");
      } catch (e) {}

      const isDirect =
        conversation.type === "direct" ||
        (conversation.otherUser && !conversation.otherUser.isGroup);
      if (isDirect) {
        loadMessages(conversation.otherUser.id);
      } else if (conversation.id) {
        loadMessages(conversation);
      } else {
        loadMessages(conversation.otherUser.id);
      }
    },
    [loadMessages]
  );

  const prevHasUserRef = useRef(!!user);
  useEffect(() => {
    const prevHadUser = !!prevHasUserRef.current;
    const nowHasUser = !!user;
    if (!nowHasUser && prevHadUser) {
      try {
        localStorage.removeItem("fluid_active_conversation");
      } catch (e) {
        console.warn(
          "Falha ao remover fluid_active_conversation do localStorage:",
          e?.message || e
        );
      }
      setActiveConversation(null);
      traceSetMessages([], "logout");
    }
    prevHasUserRef.current = nowHasUser;
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    conversations,
    activeConversation,
    messages,
    unreadCounts,
    loading,
    error,
    loadConversations,
    loadMessages,
    sendMessage,
    sendImageMessage,
    selectConversation,
    deleteConversation,
    clearError,
    addContact,
    loadUserContacts,
  };
};

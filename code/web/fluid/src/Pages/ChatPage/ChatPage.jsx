import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../hooks/useChat";
import apiService from "../../services/apiService";
import AppLayout from "../../components/Layout/AppLayout";
import MessageInput from "../../components/Message/MessageInput";
import "./ChatPage.css";

import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ChatMessage = React.memo(
  ({ message, user: currentUser, activeConversation }) => {
    const [showTranslated, setShowTranslated] = React.useState(true);
    if (!message) return null;

    const isSent = message.senderId?.toString() === currentUser?.id?.toString();

    const isGroup =
      (activeConversation &&
        (activeConversation.type === "group" ||
          activeConversation.otherUser?.isGroup)) ||
      false;

    const pickUrl = (obj) =>
      obj?.url ||
      obj?.path ||
      obj?.src ||
      obj?.fileUrl ||
      obj?.imageUrl ||
      null;
    const rawAtts =
      message.attachments ||
      message.attachment ||
      message.media ||
      message.file ||
      message.files ||
      message.data?.attachments ||
      message.data?.attachment ||
      message.payload?.attachments ||
      message.payload?.attachment ||
      [];

    const atts = (Array.isArray(rawAtts) ? rawAtts : [rawAtts])
      .filter(Boolean)
      .map((a) => ({
        url: pickUrl(a),
        fileId: a?.fileId || null,
        mime: a?.mime || a?.mimetype || a?.contentType || null,
        thumbUrl: a?.thumbUrl ?? null,
        width: a?.width ?? null,
        height: a?.height ?? null,
        size: a?.size ?? a?.bytes ?? null,
      }))
      .filter((a) => a.url || a.fileId);

    const isImageType =
      String(message.type || "").toLowerCase() === "image" ||
      atts.some((a) => String(a.mime || "").startsWith("image/"));

    const imgUrl = (() => {
      if (!isImageType) return null;
      const first = atts[0];

      if (first?.fileId) {
        return `${API_URL}/uploads/${first.fileId}`;
      }

      if (first?.url) {
        if (first.url.startsWith("http")) {
          return first.url;
        }
        return apiService.getImageUrl(first.url, "chat");
      }

      return null;
    })();

    const caption = message.caption || message.legenda || "";
    const translatedText =
      message.translatedText ||
      message.translation ||
      message.translated_content;
    const originalText =
      message.originalText || message.text || message.content || "";

    const hasTranslation =
      translatedText &&
      translatedText.trim() !== "" &&
      translatedText !== originalText;

    const shouldShowToggle = (() => {
      if (isGroup && isSent) return false;
      if (isImageType) return false;
      return hasTranslation;
    })();

    const displayText = isImageType
      ? caption
      : showTranslated && hasTranslation
      ? translatedText
      : originalText;

    const senderName =
      message.senderName ||
      message.senderNome ||
      message.sender ||
      message.senderId ||
      null;
    const senderAvatar =
      message.senderImagemPerfil || message.senderAvatar || null;

    return (
      <div className={`message-container ${isSent ? "sent" : "received"}`}>
        {!isSent && isGroup && (
          <div className="message-sender-meta">
            {senderAvatar ? (
              <img
                src={apiService.getImageUrl(senderAvatar)}
                alt={senderName || "sender"}
                className="message-sender-avatar"
              />
            ) : (
              <span className="message-sender-name-fallback">👤</span>
            )}
            <span className="message-sender-name">
              {senderName || "Usuário"}
            </span>
          </div>
        )}
        <div
          className={`message-bubble ${
            isSent ? "sent-bubble" : "received-bubble"
          }`}
        >
          {isImageType && imgUrl && (
            <div className="message-image">
              <a
                href={imgUrl}
                target="_blank"
                rel="noreferrer"
                className="image-link"
              >
                <img
                  src={imgUrl}
                  alt="imagem da conversa"
                  className="chat-image"
                />
              </a>
            </div>
          )}

          {displayText &&
            displayText.trim() !== "" &&
            displayText.trim() !== "[imagem]" && (
              <p className="message-text">{displayText}</p>
            )}

          {shouldShowToggle && (
            <div className="translation-toggle-container">
              <button
                className="translation-toggle-btn"
                onClick={() => setShowTranslated(!showTranslated)}
                title={
                  showTranslated ? "Mostrar original" : "Mostrar traduzido"
                }
              >
                {showTranslated ? "🌐 Original" : "🔤 Translated"}
              </button>
            </div>
          )}

          <span className="message-time">
            {new Date(
              message.createdAt || message.timestamp || Date.now()
            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    );
  }
);

const ChatPage = () => {
  const { user } = useAuth();
  const { contactId } = useParams();

  const {
    conversations,
    activeConversation,
    messages,
    unreadCounts,
    loading,
    error,
    loadConversations,
    sendMessage,
    sendImageMessage,
    selectConversation,
    deleteConversation,
    clearError,
    addContact,
    loadUserContacts,
  } = useChat();

  const [searchTerm, setSearchTerm] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [userContacts, setUserContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (user && !isInitialized) {
      const initialize = async () => {
        await loadConversations();
        await handleLoadUserContacts();
        setIsInitialized(true);
      };
      initialize();
    }
  }, [user, isInitialized]);

  useEffect(() => {
    if (!user || !isInitialized || !contactId) return;

    (async () => {
      try {
        const existing = conversations.find((conv) => {
          if (conv.type === "group" || conv.otherUser?.isGroup) {
            return conv.id === contactId;
          }
          const otherId = conv.otherUser?.id || conv.id || null;
          return otherId === contactId || conv.id === contactId;
        });

        if (existing) {
          selectConversation(existing);
          return;
        }

        if (contactId.length === 24 && /^[0-9a-fA-F]{24}$/.test(contactId)) {
          const resp = await apiService.getMessagesByConversation(contactId);
          if (resp && resp.success && resp.data) {
            const convo = {
              id: contactId,
              type: "group",
              otherUser: {
                id: contactId,
                nome: "Grupo",
                isGroup: true,
                status: "group",
              },
              lastMessage: null,
              unreadCount: 0,
              config: { arquivada: false, fixada: false, silenciada: false },
            };
            selectConversation(convo);
            return;
          }
        }

        const resp = await apiService.postConversation(contactId);
        if (resp && resp.success && resp.data) {
          const rawId = resp.data._id || resp.data.id;
          const convoId = rawId ? String(rawId) : undefined;
          const convo = {
            id: convoId,
            type: resp.data.type,
            participants: resp.data.participants,
            otherUser: {
              id: contactId,
              nome: resp.data.name || "Usuário",
              email: null,
              status: "offline",
              imagemPerfil: null,
            },
            lastMessage: resp.data.lastMessage || null,
            unreadCount: resp.data.unreadCount || 0,
            config: { arquivada: false, fixada: false, silenciada: false },
          };
          selectConversation(convo);
        } else {
          selectConversation({ otherUser: { id: contactId, nome: "Usuário" } });
        }
      } catch (err) {
        console.error("Erro ao selecionar conversa por contactId:", err);
      }
    })();
  }, [user, isInitialized, contactId, conversations, selectConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const handleLoadUserContacts = async () => {
    setContactsLoading(true);
    setContactsError("");
    try {
      const contacts = await loadUserContacts();
      const enriched = (contacts || []).map((c) => {
        const contatoId = c.contatoId || c.contato?.id || c.id;
        const avatarUrl = contatoId
          ? apiService.getContactImageUrl(contatoId)
          : null;
        return {
          ...c,
          contato: {
            ...(c.contato || {}),
            id: contatoId,
          },
          avatarUrl,
        };
      });
      setUserContacts(enriched);
    } catch (err) {
      console.error("Erro ao carregar contatos:", err);
      setContactsError("Erro ao carregar contatos");
    } finally {
      setContactsLoading(false);
    }
  };

  const handleAddContactClick = async (contactId) => {
    try {
      await addContact(contactId);
      await handleLoadUserContacts();
      await loadConversations();
    } catch (error) {
      console.error("Erro ao adicionar contato:", error);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const confirmDeleteChat = async () => {
    if (!activeConversation) return;
    try {
      await deleteConversation(activeConversation.otherUser.id);
      setMenuAnchorEl(null);
      selectConversation(null);
    } catch (error) {
      console.error("Erro ao excluir conversa:", error);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleMenuOpen = (event) => setMenuAnchorEl(event.currentTarget);
  const handleMenuClose = () => setMenuAnchorEl(null);

  const handleContactSelect = (contact) => {
    (async () => {
      try {
        const existingConversation = conversations.find(
          (conv) =>
            conv.otherUser.id === contact.contatoId ||
            conv.otherUser.id === contact.id
        );

        if (existingConversation) {
          selectConversation(existingConversation);
        } else {
          const otherId = contact.contatoId || contact.id;
          const resp = await apiService.postConversation(otherId);
          if (resp.success && resp.data) {
            const rawId = resp.data && (resp.data._id || resp.data.id);
            const convoId = rawId ? String(rawId) : undefined;
            const convo = {
              id: convoId,
              type: resp.data.type,
              participants: resp.data.participants,
              otherUser: {
                id: otherId,
                nome:
                  contact.contato?.nome ||
                  contact.nome ||
                  contact.apelido ||
                  contact.email,
                email: contact.contato?.email || contact.email,
                status: contact.contato?.status || contact.status,
                idiomaPadrao:
                  contact.contato?.idiomaPadrao || contact.idiomaPadrao,
              },
              lastMessage: null,
              unreadCount: 0,
              config: { arquivada: false, fixada: false, silenciada: false },
            };
            selectConversation(convo);
          } else {
            const contactUser = contact.contato || contact;
            const newConversation = {
              otherUser: {
                id: contact.contatoId || contact.id,
                nome: contactUser.nome || contact.apelido || contactUser.email,
                email: contactUser.email,
                status: contactUser.status,
                idiomaPadrao: contactUser.idiomaPadrao,
              },
              lastMessage: null,
              unreadCount: 0,
              config: { arquivada: false, fixada: false, silenciada: false },
            };
            selectConversation(newConversation);
          }
        }
      } catch (err) {
        console.error("Erro ao iniciar conversa:", err);
      } finally {
        setShowNewChatModal(false);
      }
    })();
  };

  const filteredContacts = userContacts.filter((contact) => {
    const contactName =
      contact.contato?.nome || contact.apelido || contact.contato?.email || "";
    return contactName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const ChatListItem = ({ item }) => {
    if (!item?.data?.otherUser) return null;

    const conversation = item.data;
    const isGroup =
      !!conversation.otherUser?.isGroup || conversation.type === "group";
    const isContactOnly = item.type === "contact";
    const isNonContactConversation =
      item.type === "nonContactConversation" && !isGroup;

    const contatoId = conversation.otherUser?.id;
    const avatarSrc = contatoId
      ? apiService.getContactImageUrl(contatoId)
      : null;

    const getGroupImageUrl = () => {
      if (!isGroup) return null;

      if (conversation.otherUser?.profileImageId) {
        return `${API_URL}/uploads/${
          conversation.otherUser.profileImageId
        }?t=${Date.now()}`;
      }

      if (conversation.otherUser?.imagemPerfil?.id) {
        return `${API_URL}/uploads/${
          conversation.otherUser.imagemPerfil.id
        }?t=${Date.now()}`;
      }

      if (conversation.otherUser?.imagemPerfil?.url) {
        const url = conversation.otherUser.imagemPerfil.url;
        if (url.startsWith("http")) {
          return url;
        }
        return `${API_URL}${url}?t=${Date.now()}`;
      }

      // Fallback para imagem padrão de grupo
      if (conversation.otherUser?.imagemPerfil === 'default-group') {
        return apiService.getDefaultGroupImageUrl();
      }

      return null;
    };

    const groupImageUrl = getGroupImageUrl();

    const unreadKey = isGroup ? conversation.id : conversation.otherUser?.id;
    const unreadCount = unreadCounts[unreadKey] || 0;

    const isActive = isGroup
      ? activeConversation?.id === conversation.id
      : activeConversation?.otherUser?.id === conversation.otherUser?.id;

    const onClick = () => {
      if (isContactOnly || isNonContactConversation) {
        const newConversation = {
          otherUser: conversation.otherUser,
          lastMessage: conversation.lastMessage,
          unreadCount,
          config: { arquivada: false, fixada: false, silenciada: false },
          isNonContact: isNonContactConversation,
        };
        selectConversation(newConversation);
      } else {
        selectConversation(conversation);
      }
    };

    const onAdd = (e) => {
      e.stopPropagation();
      if (conversation.otherUser?.id) {
        handleAddContactClick(conversation.otherUser.id);
      }
    };

    return (
      <div
        className={`chat-list-item ${isActive ? "active" : ""} ${
          isContactOnly ? "contact-only" : ""
        } ${isNonContactConversation ? "non-contact" : ""}`}
        onClick={onClick}
      >
        <div className="chat-avatar">
          {isGroup ? (
            groupImageUrl ? (
              <img
                src={groupImageUrl}
                alt={conversation.otherUser.nome}
                className="chat-avatar-img"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <GroupAddIcon style={{ color: "var(--stroke-strong)" }} />
            )
          ) : avatarSrc ? (
            <img src={avatarSrc} alt="avatar" className="chat-avatar-img" />
          ) : (
            <PersonOutlineIcon />
          )}
          {isContactOnly && (
            <div className="contact-indicator" title="Contato sem conversa">
              <AddIcon style={{ fontSize: 12 }} />
            </div>
          )}
          {isNonContactConversation && (
            <div className="non-contact-indicator" title="Não é contato">
              !
            </div>
          )}
        </div>
        <div className="chat-info">
          <div className="contact-header">
            <span className="contact-name">
              {conversation.otherUser.nome || "Usuário"}
              {isGroup && <span className="group-indicator">Grupo</span>}
              {isContactOnly && <span className="contact-badge">Contato</span>}
              {isNonContactConversation && (
                <span className="non-contact-badge">Não contato</span>
              )}
            </span>
            {conversation.lastMessage && (
              <span className="message-time">
                {new Date(
                  conversation.lastMessage.createdAt
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <div className="message-preview">
            <span className="last-message">
              {conversation.lastMessage?.originalText ||
                conversation.lastMessage?.text ||
                (isContactOnly
                  ? "Iniciar conversa"
                  : isNonContactConversation
                  ? "Conversa com não contato"
                  : "Nenhuma mensagem")}
            </span>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </div>
        </div>
        {isNonContactConversation && (
          <button
            className="add-contact-btn"
            onClick={onAdd}
            title="Adicionar como contato"
          >
            <AddIcon style={{ fontSize: 16 }} />
          </button>
        )}
      </div>
    );
  };

  const getCombinedConversations = () => {
    const conversationMap = new Map();

    conversations.forEach((conv) => {
      const isGroup = !!conv.otherUser?.isGroup || conv.type === "group";
      if (!conv.lastMessage && !isGroup) return;

      const other = conv.otherUser || conv;
      const otherId =
        other?.id || other?.userId || other?.contatoId || other?._id || null;

      const isContact = userContacts.some(
        (contact) =>
          contact.contatoId?.toString() === otherId?.toString() ||
          contact.id?.toString() === otherId?.toString()
      );

      const normalizedConv = {
        ...conv,
        otherUser: {
          ...other,
          id: otherId,
          imagemPerfil: other.imagemPerfil || other.avatarUrl || null,
        },
      };

      if (otherId) {
        const itemType = isGroup
          ? "groupConversation"
          : isContact
          ? "conversation"
          : "nonContactConversation";
        conversationMap.set(otherId, {
          type: itemType,
          data: { ...normalizedConv, isNonContact: !isContact && !isGroup },
          lastInteraction: conv.lastMessage?.createdAt || new Date(0),
        });
      }
    });

    return Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastInteraction) - new Date(a.lastInteraction)
    );
  };

  const combinedConversations = getCombinedConversations();
  const filteredCombined = combinedConversations.filter((item) =>
    item.data.otherUser?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ContactListItem = ({ contact }) => {
    const contactUser = contact.contato || contact;
    const displayName =
      contact.apelido || contactUser.nome || contactUser.email;
    const contatoId = contact.id || contact.contatoId;
    const avatarUrl = contatoId
      ? apiService.getContactImageUrl(contatoId)
      : null;
    return (
      <div
        className="contact-result"
        onClick={() => handleContactSelect(contact)}
      >
        <div className="contact-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="contact-avatar-img" />
          ) : (
            <PersonOutlineIcon />
          )}
        </div>
        <div className="contact-info">
          <span className="contact-name">{displayName}</span>
          {contactUser.email && (
            <span className="contact-email">{contactUser.email}</span>
          )}
          {contact.apelido && contactUser.nome && (
            <span className="contact-original-name">({contactUser.nome})</span>
          )}
        </div>
        <div className="contact-status">
          <span
            className={`status-dot ${contactUser.status || "offline"}`}
          ></span>
          {contactUser.status === "online"
            ? "Online"
            : contactUser.status === "group"
            ? "Grupo"
            : "Offline"}
        </div>
      </div>
    );
  };

  const NewChatModal = () => {
    if (!showNewChatModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
        <div className="new-chat-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Selecionar Contato</h3>
            <button
              className="close-modal"
              onClick={() => setShowNewChatModal(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="search-section">
            <div className="search-input-container">
              <SearchIcon className="search-icon" />
              <input
                type="text"
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="contact-search-input"
                autoFocus
              />
            </div>
          </div>

          <div className="search-results">
            {contactsLoading ? (
              <div className="loading">Carregando contatos...</div>
            ) : contactsError ? (
              <div className="error">{contactsError}</div>
            ) : filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <ContactListItem
                  key={contact.id || contact.contatoId}
                  contact={contact}
                />
              ))
            ) : (
              <div className="no-results">
                {searchTerm
                  ? "Nenhum contato encontrado"
                  : "Nenhum contato disponível"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const GroupMemberSelectItem = ({ contact, isSelected, onToggle }) => {
    const contactUser = contact.contato || contact;
    const contactId = contact.contatoId || contact.id;
    const displayName =
      contact.apelido || contactUser.nome || contactUser.email;
    const uniqueId = `group-member-${contactId}`;
    const avatarUrl = contactId
      ? apiService.getContactImageUrl(contactId)
      : null;
    return (
      <label htmlFor={uniqueId} className="contact-result group-member-item">
        <div className="contact-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="contact-avatar-img" />
          ) : (
            <PersonOutlineIcon />
          )}
        </div>
        <div className="contact-info">
          <span className="contact-name">{displayName}</span>
          {contactUser.email && (
            <span className="contact-email">{contactUser.email}</span>
          )}
        </div>
        <input
          type="checkbox"
          id={uniqueId}
          className="group-member-checkbox"
          checked={isSelected}
          onChange={() => onToggle(contactId)}
        />
      </label>
    );
  };

  const CreateGroupModal = () => {
    const [groupName, setGroupName] = useState("");
    const [selectedGroupMembers, setSelectedGroupMembers] = useState(new Set());
    const [groupSubmitError, setGroupSubmitError] = useState("");
    const [groupProfileImage, setGroupProfileImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    if (!showCreateGroupModal) return null;

    const handleToggleGroupMember = (contactId) => {
      setSelectedGroupMembers((prev) => {
        const n = new Set(prev);
        if (n.has(contactId)) n.delete(contactId);
        else n.add(contactId);
        return n;
      });
    };

    const handleImageUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setGroupSubmitError("Por favor, selecione uma imagem válida");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setGroupSubmitError("A imagem deve ter menos de 5MB");
        return;
      }

      setGroupProfileImage(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewUrl(event.target.result);
      };
      reader.readAsDataURL(file);
      setGroupSubmitError("");
    };

    const handleRemoveImage = () => {
      setGroupProfileImage(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };

    const handleCreateGroupSubmit = async () => {
      setGroupSubmitError("");
      if (!groupName.trim()) {
        setGroupSubmitError("O nome do grupo não pode estar vazio.");
        return;
      }
      if (selectedGroupMembers.size === 0) {
        setGroupSubmitError("Selecione pelo menos um membro.");
        return;
      }

      try {
        let profileImageId = null;

        if (groupProfileImage) {
          const formData = new FormData();
          formData.append("image", groupProfileImage);

          try {
            const uploadRes = await fetch(`${API_URL}/uploads/group-profile`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
              body: formData,
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              profileImageId = uploadData.fileId;
              console.log("Imagem do grupo enviada com sucesso:", uploadData);
            } else {
              const errorText = await uploadRes.text();
              console.error(
                "Falha no upload da imagem do grupo:",
                uploadRes.status,
                errorText
              );
            }
          } catch (uploadError) {
            console.error("Erro no upload da imagem:", uploadError);
          }
        }

        const participantIds = Array.from(selectedGroupMembers);
        const resp = await apiService.createGroup(
          groupName.trim(),
          participantIds,
          profileImageId
        );

        if (resp.success && resp.data) {
          await loadConversations();
          const createdConvo = resp.data;

          let imagemPerfil = null;
          if (createdConvo.profileImageId) {
            imagemPerfil = {
              id: createdConvo.profileImageId,
              url: `${API_URL}/uploads/${createdConvo.profileImageId}`,
            };
          }

          const convoForUI = {
            id: createdConvo._id || createdConvo.id,
            type: createdConvo.type,
            otherUser: {
              id: createdConvo._id || createdConvo.id,
              nome:
                createdConvo.name ||
                `Grupo (${(createdConvo.participants || []).length})`,
              imagemPerfil: imagemPerfil,
              isGroup: true,
            },
            participants: createdConvo.participants,
            lastMessage: null,
            unreadCount: 0,
            config: { arquivada: false, fixada: false, silenciada: false },
          };
          selectConversation(convoForUI);

          setGroupName("");
          setSelectedGroupMembers(new Set());
          setGroupProfileImage(null);
          setPreviewUrl(null);
          setGroupSubmitError("");
          setShowCreateGroupModal(false);
        } else {
          throw new Error(resp.error || "Falha ao criar grupo");
        }
      } catch (err) {
        console.error("Erro ao criar grupo:", err);
        setGroupSubmitError("Falha ao criar o grupo. Tente novamente.");
      }
    };

    return (
      <div
        className="modal-overlay"
        onClick={() => setShowCreateGroupModal(false)}
      >
        <div
          className="new-chat-modal create-group-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>Criar Novo Grupo</h3>
            <button
              className="close-modal"
              onClick={() => setShowCreateGroupModal(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="modal-body">
            <div className="group-image-section">
              <div
                className="group-image-preview"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: "pointer" }}
              >
                {previewUrl ? (
                  <div className="image-preview-container">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="group-image-preview-img"
                    />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage();
                      }}
                      title="Remover imagem"
                    >
                      <CloseIcon style={{ fontSize: 16 }} />
                    </button>
                  </div>
                ) : (
                  <div className="group-image-placeholder">
                    <AddIcon style={{ fontSize: 40, color: "var(--muted)" }} />
                    <span>Adicionar foto do grupo</span>
                    <span className="image-hint">
                      Clique para selecionar uma imagem
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
              {groupProfileImage && (
                <div className="image-info">
                  <span>{groupProfileImage.name}</span>
                  <span className="image-size">
                    {(groupProfileImage.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <input
                type="text"
                placeholder="Nome do Grupo"
                className="group-name-input"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            <div className="search-section">
              <div className="search-input-container">
                <SearchIcon className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar contatos para adicionar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="contact-search-input"
                />
              </div>
            </div>

            <div className="search-results group-members-list">
              {contactsLoading ? (
                <div className="loading">Carregando contatos...</div>
              ) : contactsError ? (
                <div className="error">{contactsError}</div>
              ) : filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => {
                  const contactId = contact.id || contact.contatoId;
                  const isSelected = selectedGroupMembers.has(contactId);
                  return (
                    <GroupMemberSelectItem
                      key={contactId}
                      contact={contact}
                      isSelected={isSelected}
                      onToggle={handleToggleGroupMember}
                    />
                  );
                })
              ) : (
                <div className="no-results">
                  {searchTerm
                    ? "Nenhum contato encontrado"
                    : "Nenhum contato disponível"}
                </div>
              )}
            </div>

            {groupSubmitError && (
              <div className="error-message">{groupSubmitError}</div>
            )}
          </div>

          <div className="modal-footer">
            <button
              className="create-group-submit-btn"
              onClick={handleCreateGroupSubmit}
              disabled={
                !groupName.trim() ||
                selectedGroupMembers.size === 0 ||
                isUploading
              }
            >
              {isUploading
                ? "Criando..."
                : `Criar Grupo (${selectedGroupMembers.size})`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ErrorMessage = () => {
    if (!error) return null;
    return (
      <div className="error-banner">
        <ErrorOutlineIcon />
        <span>{error}</span>
        <button onClick={clearError} className="close-error">
          ×
        </button>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="chat-layout">
        <aside className="chats-list-area">
          <header className="chats-header">
            <h2>Conversas</h2>
            <div className="header-actions">
              <button
                className="new-group-btn"
                title="Criar novo grupo"
                onClick={() => setShowCreateGroupModal(true)}
              >
                <GroupAddIcon />
              </button>
              <button
                className="new-chat-btn"
                title="Nova conversa"
                onClick={() => setShowNewChatModal(true)}
              >
                <EditOutlinedIcon />
              </button>
            </div>
          </header>

          <div className="search-container">
            <SearchIcon className="search-icon" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="contacts-list">
            {loading || contactsLoading ? (
              <div className="loading">Carregando...</div>
            ) : filteredCombined.length > 0 ? (
              filteredCombined.map((item, index) => (
                <ChatListItem
                  key={item.data.otherUser.id || index}
                  item={item}
                />
              ))
            ) : (
              <div className="empty-state">
                {searchTerm
                  ? "Nenhuma conversa ou contato encontrado"
                  : "Nenhuma conversa ou contato"}
              </div>
            )}
          </div>
        </aside>

        <main className="chat-window">
          <ErrorMessage />

          {activeConversation ? (
            <>
              <header className="chat-contact-header">
                {(() => {
                  const isGroup =
                    activeConversation?.type === "group" ||
                    activeConversation?.otherUser?.isGroup;

                  if (isGroup) {
                    // Lógica para imagem de grupo
                    let groupImageUrl = null;

                    if (activeConversation?.otherUser?.profileImageId) {
                      groupImageUrl = `${API_URL}/uploads/${
                        activeConversation.otherUser.profileImageId
                      }?t=${Date.now()}`;
                    } else if (
                      activeConversation?.otherUser?.imagemPerfil?.id
                    ) {
                      groupImageUrl = `${API_URL}/uploads/${
                        activeConversation.otherUser.imagemPerfil.id
                      }?t=${Date.now()}`;
                    } else if (
                      activeConversation?.otherUser?.imagemPerfil?.url
                    ) {
                      const url = activeConversation.otherUser.imagemPerfil.url;
                      groupImageUrl = url.startsWith("http")
                        ? url
                        : `${API_URL}${url}?t=${Date.now()}`;
                    } else if (
                      activeConversation?.otherUser?.imagemPerfil === 'default-group'
                    ) {
                      // Fallback para imagem padrão de grupo
                      groupImageUrl = apiService.getDefaultGroupImageUrl();
                    }

                    return (
                      <div className="chat-avatar group-avatar">
                        {groupImageUrl ? (
                          <img
                            src={groupImageUrl}
                            alt={activeConversation.otherUser.nome}
                            className="chat-avatar-img group-avatar-img"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="group-avatar-fallback">
                            <GroupAddIcon
                              style={{
                                fontSize: 24,
                                color: "var(--stroke-strong)",
                              }}
                            />
                          </div>
                        )}
                        {activeConversation?.isNonContact && (
                          <div
                            className="non-contact-header-indicator"
                            title="Não é contato"
                          >
                            !
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Lógica para avatar de usuário
                    const contatoId = activeConversation?.otherUser?.id;
                    const avatarSrc = contatoId
                      ? apiService.getContactImageUrl(contatoId)
                      : null;

                    return (
                      <div className="chat-avatar">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt="avatar"
                            className="chat-avatar-img"
                          />
                        ) : (
                          <PersonOutlineIcon />
                        )}
                        {activeConversation?.isNonContact && (
                          <div
                            className="non-contact-header-indicator"
                            title="Não é contato"
                          >
                            !
                          </div>
                        )}
                      </div>
                    );
                  }
                })()}

                <div className="contact-info">
                  <span className="contact-name">
                    {activeConversation.otherUser?.nome || "Usuário"}
                    {activeConversation?.isNonContact && (
                      <span className="non-contact-label"> (Não contato)</span>
                    )}
                  </span>
                  <span className="contact-status">
                    {activeConversation.otherUser?.status === "online"
                      ? "Online"
                      : activeConversation.otherUser?.status === "group"
                      ? "Grupo"
                      : "Offline"}
                  </span>
                </div>

                {activeConversation?.isNonContact && (
                  <button
                    className="add-contact-header-btn"
                    onClick={() =>
                      handleAddContactClick(activeConversation.otherUser.id)
                    }
                    title="Adicionar como contato"
                  >
                    <AddIcon style={{ marginRight: 4 }} />
                    Adicionar Contato
                  </button>
                )}

                <button className="menu-btn" onClick={handleMenuOpen}>
                  <MoreVertIcon />
                </button>

                <Menu
                  anchorEl={menuAnchorEl}
                  open={Boolean(menuAnchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem
                    onClick={() => setShowDeleteModal(true)}
                    style={{ color: "red" }}
                  >
                    <DeleteIcon style={{ marginRight: 8 }} />
                    Excluir conversa
                  </MenuItem>
                </Menu>
              </header>

              <div className="messages-area">
                {loading ? (
                  <div className="loading">Carregando mensagens...</div>
                ) : messages.length > 0 ? (
                  messages.map((message, index) => (
                    <ChatMessage
                      key={message.id || index}
                      message={message}
                      user={user}
                      activeConversation={activeConversation}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    Nenhuma mensagem ainda. Envie uma mensagem para iniciar a
                    conversa!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Replace the entire footer with MessageInput component */}
              <MessageInput
                onSendMessage={async (text, imageFile) => {
                  if (!activeConversation) return;

                  try {
                    const isGroup =
                      activeConversation.type === "group" ||
                      activeConversation.otherUser?.isGroup;
                    const sendTarget = isGroup
                      ? activeConversation.id || activeConversation.otherUser.id
                      : activeConversation.otherUser.id;

                    if (imageFile) {
                      await sendImageMessage(sendTarget, imageFile, "");
                    }

                    if (text && text.trim()) {
                      await sendMessage(sendTarget, text.trim());
                    }
                  } catch (error) {
                    console.error("Erro ao enviar mensagem:", error);
                  }
                }}
                disabled={!activeConversation}
                activeConversation={activeConversation}
                sendImageMessage={sendImageMessage}
                sendMessage={sendMessage}
              />
            </>
          ) : (
            <div className="no-conversation">
              <div className="no-conversation-content">
                <PersonOutlineIcon
                  style={{
                    fontSize: 64,
                    color: "var(--muted)",
                    marginBottom: 16,
                  }}
                />
                <h3>Selecione uma conversa</h3>
                <p>
                  Escolha uma conversa da lista para começar a enviar mensagens
                </p>
                <button
                  className="start-chat-btn"
                  onClick={() => setShowNewChatModal(true)}
                >
                  <AddIcon style={{ marginRight: 8 }} />
                  Iniciar Nova Conversa
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <NewChatModal />
      <CreateGroupModal />
      {showDeleteModal && (
        <div
          className="dialog-overlay"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="confirmation-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="confirmation-title">Excluir conversa</h3>
            <p className="confirmation-message">
              Tem certeza que deseja excluir esta conversa com{" "}
              {activeConversation?.otherUser?.nome}?
            </p>
            <div className="confirmation-actions">
              <button
                className="confirmation-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button
                className="confirmation-btn danger"
                onClick={confirmDeleteChat}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default ChatPage;

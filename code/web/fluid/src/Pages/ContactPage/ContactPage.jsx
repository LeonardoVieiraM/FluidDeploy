import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import { useAuth } from "../../contexts/AuthContext";
import apiService from "../../services/apiService";
import AppLayout from "../../components/Layout/AppLayout";
import "./ContactPage.css";

export default function ContactPage() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactNickname, setNewContactNickname] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [contactToRemove, setContactToRemove] = useState(null);
  const navigate = useNavigate();

  const isMobile = window.innerWidth <= 980;

  const addNotification = (message, type = "info") => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);

    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const NotificationContainer = () => (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification ${notification.type}`}
        >
          <div className="notification-icon">
            {notification.type === "success" && <CheckCircleIcon />}
            {notification.type === "error" && <ErrorIcon />}
            {notification.type === "info" && <PersonIcon />}
          </div>
          <div className="notification-content">{notification.message}</div>
          <button
            className="notification-close"
            onClick={() => removeNotification(notification.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );

  const ConfirmationDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    type = "danger",
  }) => {
    if (!isOpen) return null;

    return (
      <div className="dialog-overlay">
        <div className="confirmation-dialog">
          <h3 className="confirmation-title">{title}</h3>
          <p className="confirmation-message">{message}</p>
          <div className="confirmation-actions">
            <button className="confirmation-btn" onClick={onClose}>
              {cancelText}
            </button>
            <button className={`confirmation-btn ${type}`} onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await apiService.getContacts();

      if (result.success) {
        const formattedContacts = result.data.map((contact) => {
          const contatoId =
            contact.contatoId || contact.contato?.id || contact.id;
          const avatarUrl = contatoId
            ? apiService.getContactImageUrl(contatoId)
            : null;
          return {
            ...contact,
            id: contatoId,
            contatoId: contatoId,
            displayName: contact.apelido || contact.contato?.nome || "Usuário",
            contato: {
              ...contact.contato,
              id: contatoId,
            },
            avatarUrl,
            apelido: contact.apelido,
            originalData: contact,
          };
        });

        setContacts(formattedContacts);
      } else {
        setError(result.error || "Erro ao carregar contatos");
      }
    } catch (error) {
      setError("Erro de conexão ao carregar contatos");
      console.error("Error loading contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return "Sem telefone";
    const digits = phone.toString().replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone.toString();
  };

  const handleEditContact = async () => {
    if (!selectedContact) return;

    setShowAddDialog(false);
    const newNickname = window.prompt(
      "Digite o novo apelido:",
      selectedContact.apelido || ""
    );

    if (newNickname !== null) {
      try {
        setOperationLoading(true);
        const result = await apiService.updateContactNickname(
          selectedContact.contatoId,
          newNickname.trim() || null
        );

        if (result.success) {
          await loadContacts();
          const updatedContact = {
            ...selectedContact,
            displayName:
              newNickname.trim() || selectedContact.contato.nome || "Usuário",
            apelido: newNickname.trim() || null,
          };
          setSelectedContact(updatedContact);
          addNotification("Apelido atualizado com sucesso!", "success");
        } else {
          addNotification(
            "Erro ao atualizar apelido: " + result.error,
            "error"
          );
        }
      } catch (error) {
        addNotification("Erro ao atualizar apelido", "error");
        console.error("Error updating contact:", error);
      } finally {
        setOperationLoading(false);
      }
    }
  };

  const handleAddContact = async () => {
    const raw = newContactEmail.trim();
    if (!raw) {
      addNotification(
        "Por favor, informe um email ou telefone do contato",
        "error"
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneDigits = raw.replace(/\D/g, "");
    const isEmail = emailRegex.test(raw);
    const isPhone = phoneDigits.length >= 8;

    try {
      setOperationLoading(true);
      setError("");

      if (isEmail) {
        const searchResult = await apiService.searchUsersByEmail(raw);
        if (
          !(
            searchResult.success &&
            Array.isArray(searchResult.data) &&
            searchResult.data.length > 0
          )
        ) {
          const errorMsg =
            searchResult.error || "Usuário não encontrado com este email";
          setError(errorMsg);
          addNotification(errorMsg, "error");
          return;
        }

        const exact = searchResult.data.find((u) => u.email === raw);
        if (!exact) {
          const errorMsg = "Nenhum usuário com esse email exato foi encontrado";
          setError(errorMsg);
          addNotification(errorMsg, "error");
          return;
        }

        const userFound = exact;
        if (!userFound.id) {
          const errorMsg = "Dados do usuário inválidos";
          setError(errorMsg);
          addNotification(errorMsg, "error");
          return;
        }

        const currentUserId = apiService.getUserId();
        if (userFound.id.toString() === currentUserId.toString()) {
          const errorMsg = "Você não pode adicionar a si mesmo como contato";
          setError(errorMsg);
          addNotification(errorMsg, "error");
          return;
        }

        const contactExists = contacts.some((contact) => {
          const contactId = contact.contatoId || contact.id;
          return contactId.toString() === userFound.id.toString();
        });

        if (contactExists) {
          const errorMsg = "Este contato já está na sua lista";
          setError(errorMsg);
          addNotification(errorMsg, "error");
          return;
        }

        const result = await apiService.addContact(
          userFound.id,
          newContactNickname.trim() || null
        );
        if (result.success) {
          setShowAddDialog(false);
          setNewContactEmail("");
          setNewContactNickname("");
          await loadContacts();
          addNotification("Contato adicionado com sucesso!", "success");
        } else {
          const errorMsg = result.error || "Erro ao adicionar contato";
          setError(errorMsg);
          addNotification(errorMsg, "error");
        }
      } else if (isPhone) {
        const normalized = phoneDigits;
        const result = await apiService.addContactByPhone(
          normalized,
          newContactNickname.trim() || null
        );
        if (result.success) {
          setShowAddDialog(false);
          setNewContactEmail("");
          setNewContactNickname("");
          await loadContacts();
          addNotification("Contato adicionado com sucesso!", "success");
        } else {
          const errorMsg =
            result.error || "Erro ao adicionar contato por telefone";
          setError(errorMsg);
          addNotification(errorMsg, "error");
        }
      } else {
        addNotification(
          "Insira um email válido ou número de telefone",
          "error"
        );
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      const errorMsg =
        "Erro de conexão. Verifique sua internet e tente novamente.";
      setError(errorMsg);
      addNotification(errorMsg, "error");
    } finally {
      setOperationLoading(false);
    }
  };

  const handleRemoveContact = async (contactId, contactName, event = null) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    setContactToRemove({ id: contactId, name: contactName });
    setShowConfirmDialog(true);
  };

  const confirmRemoveContact = async () => {
    if (!contactToRemove) return;

    try {
      setOperationLoading(true);
      const result = await apiService.removeContact(contactToRemove.id);

      if (result.success) {
        const updatedContacts = contacts.filter(
          (contact) => contact.contatoId !== contactToRemove.id
        );
        setContacts(updatedContacts);

        if (
          selectedContact &&
          selectedContact.contatoId === contactToRemove.id
        ) {
          setSelectedContact(null);
          if (isMobile) {
            setShowMobileList(true);
          }
        }

        addNotification("Contato removido com sucesso!", "success");
      } else {
        addNotification("Erro ao remover contato: " + result.error, "error");
      }
    } catch (error) {
      addNotification("Erro ao remover contato", "error");
      console.error("Error removing contact:", error);
    } finally {
      setOperationLoading(false);
      setShowConfirmDialog(false);
      setContactToRemove(null);
    }
  };

  const cancelRemoveContact = () => {
    setShowConfirmDialog(false);
    setContactToRemove(null);
  };

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    if (isMobile) {
      setShowMobileList(false);
    }
  };

  const handleBackToList = () => {
    setShowMobileList(true);
    setSelectedContact(null);
  };

  if (loading && contacts.length === 0) {
    return (
      <AppLayout>
        <div className="loading">Carregando contatos...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <NotificationContainer />

      <div className="contact-content">
        {/* Contact List */}
        <aside
          className={`list ${
            isMobile && !showMobileList ? "mobile-hidden" : ""
          }`}
        >
          {isMobile && !showMobileList && (
            <button className="back-button" onClick={handleBackToList}>
              <ArrowBackIcon />
              Voltar para lista
            </button>
          )}

          <div className="list-header">
            <h2 className="list-title">Contatos</h2>
            <button
              className="add-contact-btn"
              onClick={() => setShowAddDialog(true)}
              title="Adicionar contato"
              disabled={operationLoading}
            >
              <AddIcon />
            </button>
          </div>

          <div
            className={`contacts-container ${
              contacts.length > 0 ? "has-contacts" : ""
            }`}
          >
            {contacts.length > 0
              ? contacts.map((contact) => (
                  <div
                    key={contact.contatoId}
                    className={`list-item ${
                      selectedContact?.contatoId === contact.contatoId
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() => handleContactSelect(contact)}
                  >
                    <div className="contact-avatar">
                      {console.log(
                        "Contact render avatarUrl:",
                        contact.contatoId,
                        contact.avatarUrl,
                        contact.contato?.imagemPerfil
                      )}
                      {contact.avatarUrl ? (
                        <img
                          src={contact.avatarUrl}
                          alt="avatar"
                          className="perfil-avatar-small"
                        />
                      ) : (
                        <Avatar size={36} />
                      )}
                    </div>
                    <div className="contact-info">
                      <span className="list-name">{contact.displayName}</span>
                      {contact.apelido && contact.contato?.nome && (
                        <span className="contact-original-name">
                          {contact.contato.nome}
                        </span>
                      )}
                    </div>
                    <button
                      className="remove-contact-btn"
                      onClick={(e) =>
                        handleRemoveContact(
                          contact.contatoId,
                          contact.displayName,
                          e
                        )
                      }
                      title="Remover contato"
                      disabled={operationLoading}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                ))
              : !loading && (
                  <div className="empty-state">
                    <div className="empty-state-content">
                      <PersonIcon
                        style={{
                          fontSize: 64,
                          color: "var(--muted)",
                        }}
                      />
                      <p>Nenhum contato encontrado</p>
                      <button
                        className="link"
                        onClick={() => setShowAddDialog(true)}
                        disabled={operationLoading}
                      >
                        Adicionar contatos
                      </button>
                    </div>
                  </div>
                )}
          </div>
        </aside>

        {/* Contact Details */}
        <main
          className={`contact-main ${
            isMobile && showMobileList ? "mobile-hidden" : ""
          }`}
        >
          {selectedContact ? (
            <>
              <section className="contact-card">
                <div className="card-left">
                  <h1 className="contact-title">
                    {selectedContact.displayName}
                  </h1>
                  <p className="contact-phone">
                    {formatPhone(selectedContact.contato?.numeroTelefone)}
                  </p>
                </div>
                <div className="card-right">
                  {selectedContact.avatarUrl ? (
                    <img
                      src={selectedContact.avatarUrl}
                      alt="avatar"
                      className="perfil-avatar-large"
                    />
                  ) : (
                    <Avatar size={92} bordered />
                  )}
                </div>
              </section>

              <div className="contact-details">
                <div className="field">
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={selectedContact.contato?.email || "Não informado"}
                    readOnly
                  />
                </div>

                {selectedContact.contato?.nome && selectedContact.apelido && (
                  <div className="field">
                    <label className="label">Nome original</label>
                    <input
                      className="input"
                      type="text"
                      value={selectedContact.contato.nome}
                      readOnly
                    />
                  </div>
                )}

                <div className="field">
                  <label className="label">Mensagem de Recado</label>
                  <div
                    className="recado-container"
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                      minHeight: "60px",
                      fontStyle: selectedContact.contato?.mensagemRecado
                        ? "normal"
                        : "italic",
                      color: selectedContact.contato?.mensagemRecado
                        ? "var(--text-primary)"
                        : "var(--muted)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedContact.contato?.mensagemRecado ||
                      "Este contato não definiu uma mensagem de recado"}
                  </div>
                  {selectedContact.contato?.mensagemRecado && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        textAlign: "right",
                        marginTop: "4px",
                      }}
                    ></div>
                  )}
                </div>
              </div>

              <div className="action-buttons">
                <button
                  className="primary-btn"
                  onClick={handleEditContact}
                  disabled={operationLoading}
                >
                  <EditIcon />
                  <span>
                    {operationLoading ? "Editando..." : "Editar apelido"}
                  </span>
                </button>
                <button
                  className="secondary-btn"
                  onClick={(e) =>
                    handleRemoveContact(
                      selectedContact.contatoId,
                      selectedContact.displayName,
                      e
                    )
                  }
                  disabled={operationLoading}
                >
                  <DeleteIcon />
                  <span>
                    {operationLoading ? "Removendo..." : "Remover contato"}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <div className="no-selection-content">
              <div className="no-selection">
                <PersonIcon
                  style={{
                    fontSize: 64,
                    color: "var(--muted)",
                    marginBottom: 16,
                  }}
                />
                <h2>Nenhum contato selecionado</h2>
                <p>Selecione um contato da lista para ver os detalhes</p>
                {contacts.length === 0 && (
                  <button
                    className="link"
                    onClick={() => setShowAddDialog(true)}
                    disabled={operationLoading}
                  >
                    Adicione seu primeiro contato
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add Contact Dialog */}
      {showAddDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3 className="dialog-title">Adicionar Contato</h3>

            <div className="dialog-field">
              <label className="dialog-label">
                Email ou telefone do contato *
              </label>
              <input
                className="dialog-input"
                type="email"
                value={newContactEmail}
                onChange={(e) => {
                  setNewContactEmail(e.target.value);
                  setError("");
                }}
                placeholder="exemplo@email.com ou (99) 99999-9999"
                disabled={operationLoading}
                autoFocus
              />
            </div>

            <div className="dialog-field">
              <label className="dialog-label">Apelido (opcional)</label>
              <input
                className="dialog-input"
                type="text"
                value={newContactNickname}
                onChange={(e) => setNewContactNickname(e.target.value)}
                placeholder="Como você quer chamar este contato"
                disabled={operationLoading}
              />
            </div>

            {error && (
              <div
                className="error-message"
                style={{
                  margin: "16px 0",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 107, 107, 0.1)",
                  border: "1px solid rgba(255, 107, 107, 0.3)",
                  color: "#ff6b6b",
                }}
              >
                {error}
              </div>
            )}

            <div className="dialog-actions">
              <button
                className="dialog-btn"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewContactEmail("");
                  setNewContactNickname("");
                  setError("");
                }}
                disabled={operationLoading}
              >
                Cancelar
              </button>
              <button
                className="dialog-btn primary"
                onClick={handleAddContact}
                disabled={operationLoading || !newContactEmail.trim()}
              >
                {operationLoading ? "Adicionando..." : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={cancelRemoveContact}
        onConfirm={confirmRemoveContact}
        title="Remover Contato"
        message={`Tem certeza que deseja remover ${contactToRemove?.name} dos seus contatos?`}
        confirmText="Remover"
        type="danger"
      />
    </AppLayout>
  );
}

const AddIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" className="stroke">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const Avatar = ({ size = 36, bordered = false }) => (
  <div
    className={`avatar ${bordered ? "avatar-bordered" : ""}`}
    style={{ width: size, height: size }}
  >
    <svg
      width={size - (bordered ? 24 : 0)}
      height={size - (bordered ? 24 : 0)}
      viewBox="0 0 24 24"
      className="avatar-svg"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  </div>
);

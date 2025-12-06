const API_BASE = "http://localhost:3001/api";

class ApiService {
  getContactImageUrl(contactId) {
    if (!contactId) return null;
    // Se for o identificador especial de grupo, retorna a imagem padrão de grupo
    if (contactId === 'default-group') {
      return this.getDefaultGroupImageUrl();
    }
    const timestamp = Date.now();
    return `${API_BASE}/usuarios/${contactId}/imagem-perfil?t=${timestamp}`;
  }

  getDefaultGroupImageUrl() {
    const timestamp = Date.now();
    return `${API_BASE}/conversas/default-group-image?t=${timestamp}`;
  }
  constructor() {
    this.token = localStorage.getItem("token");
  }

  getHeaders() {
    const headers = { "Content-Type": "application/json" };
    const currentToken = localStorage.getItem("token");
    if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;
    return headers;
  }

  async handleResponse(response) {
    try {
      if (!response)
        return { success: false, error: "Sem resposta do servidor" };

      const contentType = response.headers.get("content-type") || "";
      let data, rawText;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        rawText = await response.text();
      }

      if (response.ok) return { success: true, data: data ?? rawText };

      const err =
        (data && (data.error || data.message)) ||
        rawText ||
        `Erro HTTP: ${response.status}`;
      console.error("API ERROR:", response.status, err, { data });
      return { success: false, error: err, status: response.status, data };
    } catch (error) {
      console.error("Erro ao processar resposta:", error);
      return {
        success: false,
        error: "Erro ao processar resposta do servidor",
      };
    }
  }

  getImageUrl(fileId, type = "profile") {
    if (!fileId) return null;
    const timestamp = Date.now();

    if (type === "profile") {
      return `${API_BASE}/usuarios/${fileId}/imagem-perfil?t=${timestamp}`;
    } else if (type === "chat") {
      return `${API_BASE}/uploads/${fileId}?t=${timestamp}`;
    }

    return null;
  }

  async getProfile() {
    const r = await fetch(`${API_BASE}/usuarios/me`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(r);
  }

  async updateProfile(profileData) {
    const r = await fetch(`${API_BASE}/usuarios/me`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(profileData),
    });
    return this.handleResponse(r);
  }

  async updateUserStatus(userId, status) {
    const r = await fetch(`${API_BASE}/usuarios/${userId}/status`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    return this.handleResponse(r);
  }

  async updateRecado(mensagemRecado) {
    const userId = this.getUserId();
    const r = await fetch(`${API_BASE}/usuarios/${userId}/recado`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ mensagemRecado }),
    });
    return this.handleResponse(r);
  }

  async updateUserIdioma(userId, idioma) {
    const r = await fetch(`${API_BASE}/usuarios/${userId}/idioma`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ idioma }),
    });
    return this.handleResponse(r);
  }

  async updateUserSenha(userId, senhaAtual, novaSenha) {
    const r = await fetch(`${API_BASE}/usuarios/${userId}/senha`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
    return this.handleResponse(r);
  }

  async uploadProfileImage(file) {
    try {
      const form = new FormData();
      form.append("imagem", file);
      const headers = {};
      const token = localStorage.getItem("token");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/usuarios/me/imagem`, {
        method: "POST",
        headers,
        body: form,
      });
      return this.handleResponse(r);
    } catch (err) {
      console.error("Erro uploadProfileImage", err);
      return {
        success: false,
        error: err.message || "Erro ao enviar imagem",
        details: "Verifique se o servidor está rodando na porta 3001",
      };
    }
  }

  async getContacts() {
    const r = await fetch(`${API_BASE}/usuarios/${this.getUserId()}/contatos`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(r);
  }

  async addContact(contactId, apelido = null) {
    const userId = this.getUserId();
    const r = await fetch(`${API_BASE}/usuarios/${userId}/contatos`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ contatoId: contactId, apelido }),
    });
    return this.handleResponse(r);
  }

  async addContactByEmail(email, apelido = null) {
    const r = await fetch(
      `${API_BASE}/usuarios/${this.getUserId()}/contatos/por-email`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ email, apelido }),
      }
    );
    return this.handleResponse(r);
  }

  async addContactByPhone(numeroTelefone, apelido = null) {
    const r = await fetch(
      `${API_BASE}/usuarios/${this.getUserId()}/contatos/por-telefone`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ numeroTelefone, apelido }),
      }
    );
    return this.handleResponse(r);
  }

  async removeContact(contactId) {
    const r = await fetch(
      `${API_BASE}/usuarios/${this.getUserId()}/contatos/${contactId}`,
      { method: "DELETE", headers: this.getHeaders() }
    );
    return this.handleResponse(r);
  }

  async updateContactNickname(contactId, apelido) {
    const r = await fetch(
      `${API_BASE}/usuarios/${this.getUserId()}/contatos/${contactId}`,
      {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({ apelido }),
      }
    );
    return this.handleResponse(r);
  }

  async sendMessage(recipientId, text, sourceLang = null) {
    const r = await fetch(`${API_BASE}/mensagens`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        recipientId: String(recipientId),
        text,
        sourceLang,
      }),
    });
    return this.handleResponse(r);
  }

  async getConversation(otherUserId, limit = 50, offset = 0) {
    const r = await fetch(
      `${API_BASE}/mensagens/conversa/${otherUserId}?limit=${limit}&offset=${offset}`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse(r);
  }

  async getMessagesByConversation(conversationId, limit = 50, offset = 0) {
    const timestamp = new Date().getTime();
    const r = await fetch(
      `${API_BASE}/conversas/${conversationId}/messages?limit=${limit}&offset=${offset}&_=${timestamp}`,
      {
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse(r);
  }

  async translateText(text, sourceLang, targetLang) {
    const r = await fetch(`${API_BASE}/translation/translate`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    return this.handleResponse(r);
  }

  async markConversationAsReadByConversation(
    conversationId,
    untilMessageId = null
  ) {
    const r = await fetch(`${API_BASE}/conversas/${conversationId}/read`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ untilMessageId }),
    });
    return this.handleResponse(r);
  }

  async markConversationAsRead(otherUserId, untilMessageId = null) {
    const r = await fetch(
      `${API_BASE}/mensagens/conversa/${otherUserId}/read`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ untilMessageId }),
      }
    );
    return this.handleResponse(r);
  }

  async getUnreadCounts() {
    const r = await fetch(`${API_BASE}/mensagens/nao-lidas`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(r);
  }

  async getConversations(limit = 20) {
    const r = await fetch(`${API_BASE}/conversas?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(r);
  }

  async deleteConversation(conversationId) {
    const r = await fetch(`${API_BASE}/conversas/${conversationId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse(r);
  }

  async postConversation(otherUserId) {
    const r = await fetch(`${API_BASE}/conversas`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ otherUserId }),
    });
    return this.handleResponse(r);
  }

  async createGroup(name, participants = [], profileImageId = null) {
    const r = await fetch(`${API_BASE}/conversas`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: "group",
        name,
        participants,
        profileImageId,
      }),
    });
    return this.handleResponse(r);
  }

  async uploadGroupProfileImage(file) {
    try {
      const form = new FormData();
      form.append("image", file);

      const headers = {};
      const token = localStorage.getItem("token");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/uploads/group-profile`, {
        method: "POST",
        headers,
        body: form,
      });
      return this.handleResponse(r);
    } catch (err) {
      console.error("uploadGroupProfileImage error:", err);
      return { success: false, error: err.message || "Falha no upload" };
    }
  }

  async searchUserContacts(searchTerm, limit = 20) {
    const userId = this.getUserId();
    if (!userId) return { success: false, error: "Usuário não autenticado" };

    const r = await fetch(
      `${API_BASE}/usuarios/${userId}/contatos/busca?q=${encodeURIComponent(
        searchTerm
      )}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse(r);
  }

  async searchContacts(searchTerm, limit = 20) {
    const r = await fetch(
      `${API_BASE}/usuarios/busca?q=${encodeURIComponent(
        searchTerm
      )}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse(r);
  }

  async searchUsers(query, limit = 20) {
    const r = await fetch(
      `${API_BASE}/usuarios/busca?q=${encodeURIComponent(
        query
      )}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse(r);
  }

  async searchUsersByEmail(email, limit = 20) {
    const r = await fetch(
      `${API_BASE}/usuarios/busca?email=${encodeURIComponent(
        email
      )}&limit=${limit}`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse(r);
  }

  setToken(newToken) {
    this.token = newToken;
    localStorage.setItem("token", newToken);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("token");
  }

  getUserId() {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.userId || payload.sub;
    } catch (e) {
      console.error("Error decoding token:", e);
      return null;
    }
  }

  async uploadChatImage(file) {
    try {
      const form = new FormData();
      form.append("file", file);

      const headers = {};
      const token = localStorage.getItem("token");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch(`${API_BASE}/uploads`, {
        method: "POST",
        headers,
        body: form,
      });
      return this.handleResponse(r);
    } catch (err) {
      console.error("uploadChatImage error:", err);
      return { success: false, error: err.message || "Falha no upload" };
    }
  }

  async sendImageMessage(recipientId, uploadedResult, caption = "") {
    const raw =
      uploadedResult?.data?.attachment ||
      uploadedResult?.data ||
      uploadedResult;

    const fileId = raw?.fileId || raw?.id;
    if (!fileId) {
      return {
        success: false,
        error: "Upload não retornou fileId do GridFS.",
      };
    }

    const attachment = {
      fileId: fileId,
      url: raw?.url || `/api/uploads/${fileId}`,
      thumbUrl: raw?.thumbUrl ?? null,
      width: raw?.width ?? null,
      height: raw?.height ?? null,
      size: raw?.size ?? raw?.bytes ?? null,
      mime: raw?.mime || raw?.mimetype || raw?.contentType || "image/jpeg",
      originalName: raw?.originalName || null,
    };

    const captionSafe = ((caption ?? "") + "").trim();
    const textToSend = captionSafe || "[imagem]";

    const body = {
      recipientId,
      type: "image",
      text: textToSend,
      attachments: [attachment],
    };

    const r = await fetch(`${API_BASE}/mensagens`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(r);
  }
}

export default new ApiService();

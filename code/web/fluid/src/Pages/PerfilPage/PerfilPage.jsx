import { useMemo, useState, useEffect, useRef } from "react";
import apiService from "../../services/apiService";
import { Link } from "react-router-dom";
import { IDIOMAS_SUPORTADOS } from "../../services/idiomas";
import "./PerfilPage.css";

export default function PerfilPage() {
  const [modalError, setModalError] = useState("");
  function handleTelefoneChange(e) {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 18) {
      setModalError("O telefone não pode ter mais de 18 dígitos.");
      return;
    } else {
      setModalError("");
    }
    let masked = val;
    if (val.length > 0 && val.length <= 2) {
      masked = `(+${val}`;
    } else if (val.length > 2 && val.length <= 4) {
      masked = `(+${val.slice(0, 2)}) ${val.slice(2)}`;
    } else if (val.length > 4 && val.length <= 9) {
      masked = `(+${val.slice(0, 2)}) ${val.slice(2, 4)} ${val.slice(4)}`;
    } else if (val.length > 9 && val.length <= 11) {
      masked = `(+${val.slice(0, 2)}) ${val.slice(2, 4)} ${val.slice(
        4,
        9
      )}-${val.slice(9)}`;
    } else if (val.length > 11) {
      masked = `(+${val.slice(0, 2)}) ${val.slice(2, 4)} ${val.slice(
        4,
        9
      )}-${val.slice(9, 13)}`;
    }
    setFormInfo((prev) => ({ ...prev, numeroTelefone: masked }));
  }
  function formatNumeroTelefone(tel) {
    if (!tel) return "";
    const digits = tel.replace(/\D/g, "");
    if (digits.length <= 2) {
      return `(+${digits}`;
    }
    if (digits.length <= 4) {
      return `(+${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length <= 9) {
      return `(+${digits.slice(0, 2)}) ${digits.slice(2, 4)} ${digits.slice(
        4
      )}`;
    }
    if (digits.length <= 11) {
      return `(+${digits.slice(0, 2)}) ${digits.slice(2, 4)} ${digits.slice(
        4,
        9
      )}-${digits.slice(9)}`;
    }
    return `(+${digits.slice(0, 2)}) ${digits.slice(2, 4)} ${digits.slice(
      4,
      9
    )}-${digits.slice(9, 13)}`;
  }
  const [user, setUser] = useState({
    id: "",
    nome: "",
    email: "",
    numeroTelefone: "",
    mensagemRecado: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      const res = await apiService.getProfile();
      if (res.success && res.data) {
        const fetched = res.data;

        const avatarUrl = apiService.getImageUrl(fetched.id);

        setUser((prevUser) => ({
          ...prevUser,
          ...fetched,
          avatarUrl,
        }));

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...fetched,
            avatarUrl,
          })
        );
      } else {
        setLocalError(res.error || "Erro ao buscar perfil");
      }
    }
    fetchProfile();
  }, []);

  const idiomas = IDIOMAS_SUPORTADOS;
  const statusOptions = useMemo(
    () => ["Disponível", "Ocupado", "Em reunião", "Trabalhando", "Offline"],
    []
  );

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formInfo, setFormInfo] = useState({
    nome: "",
    email: "",
    numeroTelefone: "",
    sobre: "",
    mensagemRecado: "",
  });

  const [editIdioma, setEditIdioma] = useState(false);
  const [formIdioma, setFormIdioma] = useState({ idioma: "pt-BR" });

  const [editSenha, setEditSenha] = useState(false);
  const [formSenha, setFormSenha] = useState({
    senhaAtual: "",
    novaSenha: "",
    confirmar: "",
  });
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [showPwd3, setShowPwd3] = useState(false);

  const [localError, setLocalError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef(null);
  const [previewSrc, setPreviewSrc] = useState(null);

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  }

  const onChange = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
    if (localError) setLocalError("");
  };

  const abrirEdicao = () => {
    setFormInfo({
      nome: user.nome,
      email: user.email,
      numeroTelefone: user.numeroTelefone,
      sobre: user.sobre,
      mensagemRecado: user.mensagemRecado || "",
    });
    setModalError("");
    setIsEditOpen(true);
  };
  const cancelarEdicaoComErro = () => {
    setModalError("");
    setIsEditOpen(false);
  };

  const confirmarEdicaoLocal = async () => {
    const { nome, email, numeroTelefone, mensagemRecado } = formInfo;
    if (!nome.trim()) return setLocalError("O nome é obrigatório.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setLocalError("E-mail inválido.");

    setLocalError("");
    const payload = {
      ...formInfo,
      numeroTelefone: numeroTelefone.replace(/\D/g, ""),
    };
    const res = await apiService.updateProfile(payload);
    if (res.success && res.data) {
      setUser((u) => ({
        ...u,
        nome: payload.nome,
        email: payload.email,
        numeroTelefone: formInfo.numeroTelefone,
        mensagemRecado: payload.mensagemRecado || formInfo.mensagemRecado,
      }));
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...user,
          nome: payload.nome,
          email: payload.email,
          numeroTelefone: payload.numeroTelefone,
          mensagemRecado: payload.mensagemRecado || formInfo.mensagemRecado,
        })
      );
      setIsEditOpen(false);
      showSuccess("Alterações salvas com sucesso!");
    } else {
      setLocalError(res.error || "Erro ao atualizar perfil");
    }
  };

  const onChangeStatusLocal = async (e) => {
    const novo = e.target.value;
    setLocalError("");
    const userId = user.id || apiService.getUserId();
    if (!userId) return setLocalError("ID do usuário não encontrado");
    const res = await apiService.updateUserStatus(userId, novo);
    if (res.success && res.data) {
      setUser((u) => ({ ...u, status: novo }));
      localStorage.setItem("user", JSON.stringify({ ...user, status: novo }));
      showSuccess("Status atualizado com sucesso!");
    } else {
      setLocalError(res.error || "Erro ao atualizar status");
    }
  };

  const salvarIdiomaLocal = async () => {
    if (!formIdioma.idioma) return setLocalError("Selecione um idioma.");
    setLocalError("");
    const userId = user.id || apiService.getUserId();
    if (!userId) return setLocalError("ID do usuário não encontrado");
    const res = await apiService.updateUserIdioma(userId, formIdioma.idioma);
    if (res.success && res.data) {
      setUser((u) => ({ ...u, idioma: formIdioma.idioma }));
      localStorage.setItem(
        "user",
        JSON.stringify({ ...user, idioma: formIdioma.idioma })
      );
      setEditIdioma(false);
      showSuccess("Idioma atualizado com sucesso!");
    } else {
      setLocalError(res.error || "Erro ao atualizar idioma");
    }
  };

  const salvarSenhaLocal = async () => {
    if (formSenha.novaSenha.length < 6)
      return setLocalError("A nova senha deve ter no mínimo 6 caracteres.");
    if (formSenha.novaSenha !== formSenha.confirmar)
      return setLocalError("A confirmação da senha não confere.");

    setLocalError("");
    const userId = user.id || apiService.getUserId();
    if (!userId) return setLocalError("ID do usuário não encontrado");
    const res = await apiService.updateUserSenha(
      userId,
      formSenha.senhaAtual,
      formSenha.novaSenha
    );
    if (res.success) {
      setFormSenha({ senhaAtual: "", novaSenha: "", confirmar: "" });
      setEditSenha(false);
      showSuccess("Senha alterada com sucesso!");
    } else {
      setLocalError(res.error || "Erro ao alterar senha");
    }
  };

  return (
    <main className="container">
      <section className="card perfil-card">
        <Link to="/chat" className="back">
          ← Voltar
        </Link>
        <h1 style={{ marginTop: 8 }}>Perfil Page </h1>

        {localError && (
          <div className="error-message" style={{ marginBottom: 12 }}>
            {localError}
          </div>
        )}

        {/* GRID responsivo */}
        <div className="perfil-grid">
          {/* Coluna esquerda */}
          <div>
            <div className="perfil-avatar-box">
              {/* Avatar com fallback */}
              <img
                src={previewSrc || user.avatarUrl || "/logo.png"}
                alt="Avatar"
                className="perfil-avatar"
                onError={(e) => {
                  if (e.target.src !== "/logo.png") {
                    e.target.src = "/logo.png";
                  }
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;

                  setPreviewSrc(URL.createObjectURL(file));
                  setLocalError("");

                  try {
                    const res = await apiService.uploadProfileImage(file);
                    if (res.success && res.data) {
                      const updated = res.data.usuario || res.data;

                      const timestamp = Date.now();
                      const avatarUrl = `${apiService.getImageUrl(
                        updated.id || user.id
                      )}&refresh=${timestamp}`;

                      setUser((u) => ({
                        ...u,
                        ...updated,
                        avatarUrl,
                        profileImageId: res.data.imageId,
                      }));

                      localStorage.setItem(
                        "user",
                        JSON.stringify({
                          ...updated,
                          avatarUrl,
                          profileImageId: res.data.imageId,
                        })
                      );

                      setPreviewSrc(null);
                      showSuccess("Imagem de perfil atualizada com sucesso");

                      setTimeout(() => {
                        setUser((prev) => ({
                          ...prev,
                          avatarUrl:
                            apiService.getImageUrl(updated.id || user.id) +
                            `&force=${Date.now()}`,
                        }));
                      }, 100);
                    } else {
                      setLocalError(res.error || "Erro ao enviar imagem");
                      setPreviewSrc(null);
                    }
                  } catch (error) {
                    console.error("Upload error:", error);
                    setLocalError("Erro ao fazer upload da imagem");
                    setPreviewSrc(null);
                  }
                }}
              />
              <div style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  onClick={() =>
                    fileInputRef.current && fileInputRef.current.click()
                  }
                >
                  Alterar foto
                </button>
              </div>
            </div>

            <div className="perfil-status">
              <label className="field">
                <span>Status</span>
                <select
                  name="status"
                  value={user.status}
                  onChange={onChangeStatusLocal}
                  className="perfil-select"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="perfil-box">
              <div className="muted perfil-label">Mensagem de Recado</div>
              <div
                className="perfil-value"
                style={{
                  fontStyle: user.mensagemRecado ? "normal" : "italic",
                  color: user.mensagemRecado ? "#f5f5f5" : "#888",
                }}
              >
                {user.mensagemRecado || "Nenhuma mensagem de recado definida"}
              </div>
            </div>
          </div>

          {/* Coluna direita: Informações */}
          <div className="perfil-right">
            <div className="perfil-between" style={{ marginBottom: 6 }}>
              <h2 className="perfil-h2" style={{ margin: 0 }}>
                Informações
              </h2>
              <button
                className="btn perfil-btn-mobile"
                onClick={abrirEdicao}
                aria-label="Editar informações"
                title="Editar nome, email, telefone e descrição"
              >
                Editar informações
              </button>
            </div>

            <div className="perfil-box">
              <div className="muted perfil-label">Nome de Usuário </div>
              <div className="perfil-value">{user.nome}</div>
            </div>
            <div className="perfil-box">
              <div className="muted perfil-label">Email</div>
              <div className="perfil-value">{user.email}</div>
            </div>
            <div className="perfil-box">
              <div className="muted perfil-label">Telefone</div>
              <div className="perfil-value">
                {formatNumeroTelefone(user.numeroTelefone) || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Idioma */}
        <div className="perfil-section">
          <div className="perfil-between">
            <h2 className="perfil-h2">Idioma</h2>
            <button className="btn" onClick={() => setEditIdioma((v) => !v)}>
              {editIdioma ? "Pronto" : "Editar"}
            </button>
          </div>
          {editIdioma ? (
            <div className="form" style={{ marginTop: 12 }}>
              <label className="field">
                <span>Selecione o idioma</span>
                <select
                  name="idioma"
                  value={formIdioma.idioma}
                  onChange={onChange(setFormIdioma)}
                  className="perfil-select"
                >
                  {idiomas.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="perfil-row">
                <button
                  className="btn perfil-btn-mobile"
                  onClick={() => {
                    setFormIdioma({ idioma: user.idioma || idiomas[0] });
                    setEditIdioma(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="btn primary perfil-btn-mobile"
                  onClick={salvarIdiomaLocal}
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <p style={{ marginTop: 8 }}>
              Atual: <strong>{user.idioma || user.idiomaPadrao || "—"}</strong>
            </p>
          )}
        </div>

        {/* Senha */}
        <div className="perfil-section">
          <div className="perfil-between">
            <h2 className="perfil-h2">Senha</h2>
            <button className="btn" onClick={() => setEditSenha((v) => !v)}>
              {editSenha ? "Pronto" : "Alterar"}
            </button>
          </div>
          {editSenha && (
            <div className="form" style={{ marginTop: 12 }}>
              {/* passwordRow precisa ser definido no final do arquivo */}
              {passwordRow(
                "Senha atual",
                "senhaAtual",
                formSenha.senhaAtual,
                showPwd1,
                setShowPwd1,
                onChange(setFormSenha)
              )}
              {passwordRow(
                "Nova senha",
                "novaSenha",
                formSenha.novaSenha,
                showPwd2,
                setShowPwd2,
                onChange(setFormSenha)
              )}
              {passwordRow(
                "Confirmar nova senha",
                "confirmar",
                formSenha.confirmar,
                showPwd3,
                setShowPwd3,
                onChange(setFormSenha)
              )}
              <div className="perfil-row">
                <button
                  className="btn perfil-btn-mobile"
                  onClick={() => {
                    setFormSenha({
                      senhaAtual: "",
                      novaSenha: "",
                      confirmar: "",
                    });
                    setEditSenha(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  className="btn primary perfil-btn-mobile"
                  onClick={salvarSenhaLocal}
                >
                  Alterar senha
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer style={{ marginTop: 12 }}>
        <small>© {new Date().getFullYear()} Fluid</small>
      </footer>

      {/* Modal Edit (wireframe 2) */}
      {isEditOpen && (
        <Modal onClose={cancelarEdicaoComErro} title="Editar informações">
          <div className="form">
            {modalError && (
              <div className="error-message" style={{ marginBottom: 12 }}>
                {modalError}
              </div>
            )}
            <label className="field">
              <span>Nome:</span>
              <input
                name="nome"
                value={formInfo.nome}
                onChange={onChange(setFormInfo)}
                placeholder="Seu nome"
              />
            </label>
            <label className="field">
              <span>Email:</span>
              <input
                type="email"
                name="email"
                value={formInfo.email}
                onChange={onChange(setFormInfo)}
                placeholder="seu@email.com"
              />
            </label>
            <label className="field">
              <span>Telefone:</span>
              <input
                name="numeroTelefone"
                value={formatNumeroTelefone(formInfo.numeroTelefone)}
                onChange={handleTelefoneChange}
                placeholder="(+55) 31 12345-1234"
                maxLength={22}
              />
            </label>
            <label className="field">
              <span>Mensagem de Recado (max. 100 caracteres):</span>
              <textarea
                name="mensagemRecado"
                value={formInfo.mensagemRecado}
                onChange={onChange(setFormInfo)}
                placeholder="Digite uma mensagem de recado..."
                maxLength={100}
                rows={3}
                style={{
                  resize: "vertical",
                  minHeight: "80px",
                }}
              />
              <div
                style={{
                  fontSize: "12px",
                  color:
                    formInfo.mensagemRecado.length > 90 ? "#ff6b6b" : "#888",
                  textAlign: "right",
                  marginTop: "4px",
                }}
              >
                {formInfo.mensagemRecado.length}/100
              </div>
            </label>
            <div className="perfil-modal-actions">
              <button
                className="btn perfil-btn-mobile"
                onClick={cancelarEdicaoComErro}
              >
                Cancelar
              </button>
              <button
                className="btn primary perfil-btn-mobile"
                onClick={confirmarEdicaoLocal}
                disabled={!!modalError}
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Mensagem de sucesso */}
      {successMsg && (
        <div
          style={{
            background: "#2ecc40",
            color: "#fff",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            textAlign: "center",
            fontWeight: 500,
            fontSize: 16,
          }}
        >
          {successMsg}
        </div>
      )}
    </main>
  );
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>{title}</h2>
          {/* <button className="btn" onClick={onClose} aria-label="Fechar modal">×</button> */}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function passwordRow(label, name, value, visible, setVisible, onChange) {
  return (
    <label className="field perfil-pwd-row">
      <span>{label}</span>
      <div style={{ display: "flex", alignItems: "center" }}>
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete="off"
        />
        <button
          type="button"
          className="btn perfil-pwd-toggle"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          style={{ marginLeft: 8 }}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </label>
  );
}

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(20, 20, 20, 0.92)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const modalStyle = {
  background: "rgba(15, 20, 48, 1)",
  color: "#f5f5f5",
  borderRadius: 12,
  boxShadow: "0 2px 32px rgba(0,0,0,0.38)",
  padding: 32,
  minWidth: 420,
  maxWidth: 500,
  width: "90vw",
  maxHeight: "90vh",
  overflowY: "auto",
  position: "relative",
};

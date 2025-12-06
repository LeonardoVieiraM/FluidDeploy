import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "./SignInPage.css";

const SignInPage = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { cadastrar } = useAuth();
  const navigate = useNavigate();

  const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

  const formatPhoneBR = (digs) => {
    const d = digs.slice(0, 11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10)
      return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (error) setError("");

    if (name === "phone") {
      const digits = onlyDigits(value);
      setForm((prev) => ({
        ...prev,
        phone: formatPhoneBR(digits),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (form.password !== form.confirm) {
        throw new Error("As senhas não coincidem.");
      }

      if (form.password.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
      }

      if (form.name.length < 2) {
        throw new Error("O nome deve ter pelo menos 2 caracteres.");
      }

      if (!form.email.trim()) {
        throw new Error("O email é obrigatório.");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        throw new Error("Email inválido.");
      }

      const dadosUsuario = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone:
          form.phone.trim() === "" || onlyDigits(form.phone) === ""
            ? null
            : onlyDigits(form.phone),
      };

      const result = await cadastrar(dadosUsuario);

      if (result.success) {
        const userWithDefaultImage = {
          ...result.user,
          avatarUrl: "/logo.png",
        };
        localStorage.setItem("user", JSON.stringify(userWithDefaultImage));
        navigate("/chat");
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <section className="card">
        <Link to="/" className="back">
          ← Voltar
        </Link>
        <img src="/logo.png" alt="Logo Fluid" className="logo" />
        <h1>Criar conta</h1>
        <p className="tagline">Crie sua conta para começar.</p>

        {error && <div className="error-message">{error}</div>}

        <form className="form" autoComplete="on" onSubmit={handleSubmit}>
          <label className="field">
            <span>Nome completo</span>
            <input
              type="text"
              name="name"
              placeholder="Seu nome"
              minLength={2}
              required
              value={form.name}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              name="email"
              placeholder="seu@email.com"
              required
              value={form.email}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span>Telefone (opcional)</span>
            <input
              type="tel"
              name="phone"
              inputMode="tel"
              placeholder="(31) 91234-5678"
              autoComplete="tel-national"
              maxLength={16}
              value={form.phone}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <div className="input-wrap">
              <input
                type={showPwd ? "text" : "password"}
                name="password"
                placeholder="mín. 6 caracteres"
                minLength={6}
                required
                value={form.password}
                onChange={handleChange}
              />
              <button
                type="button"
                className="togglePwd"
                data-state={showPwd ? "visible" : "hidden"}
                aria-label="Mostrar/ocultar senha"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
              >
                <svg
                  className="eye open"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  className="eye closed"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.77 21.77 0 014.5-5.94m4.21-2.21A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.77 21.77 0 01-2.06 3.06M1 1l22 22" />
                </svg>
              </button>
            </div>
          </label>

          <label className="field">
            <span>Confirmar senha</span>
            <div className="input-wrap">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirm"
                placeholder="repita a senha"
                minLength={6}
                required
                value={form.confirm}
                onChange={handleChange}
              />
              <button
                type="button"
                className="togglePwd"
                data-state={showConfirm ? "visible" : "hidden"}
                aria-label="Mostrar/ocultar confirmação"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
              >
                <svg
                  className="eye open"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  className="eye closed"
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.77 21.77 0 014.5-5.94m4.21-2.21A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.77 21.77 0 01-2.06 3.06M1 1l22 22" />
                </svg>
              </button>
            </div>
          </label>

          <button
            className="btn primary block"
            type="submit"
            disabled={loading}
          >
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>

        <p className="muted small">
          Já tem conta?
          <Link to="/login" className="link">
            Faça login
          </Link>
        </p>
      </section>
      <footer>
        <small>© {new Date().getFullYear()} Fluid</small>
      </footer>
    </main>
  );
};

export default SignInPage;

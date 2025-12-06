import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "./LoginPage.css";

const LoginPage = () => {
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (form.password.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
      }

      if (!form.email.trim()) {
        throw new Error("O email é obrigatório.");
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        throw new Error("Email inválido.");
      }

      const result = await login(form.email, form.password, form.remember);

      if (result.success) {
        navigate("/contato");
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
        <h1>Entrar</h1>
        <p className="tagline">Bem-vindo de volta.</p>

        {error && <div className="error-message">{error}</div>}

        <form className="form" autoComplete="on" onSubmit={handleSubmit}>
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
            <span>Senha</span>
            <div className="input-wrap">
              <input
                type={showPwd ? "text" : "password"}
                name="password"
                placeholder="••••••••"
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

          <label className="check">
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={handleChange}
            />{" "}
            Manter conectado
          </label>

          <button
            className="btn primary block"
            type="submit"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="muted small">
          Não tem conta?
          <Link to="/cadastro" className="link">
            Crie agora
          </Link>
        </p>
      </section>
      <footer>
        <small>© {new Date().getFullYear()} Fluid</small>
      </footer>
    </main>
  );
};

export default LoginPage;

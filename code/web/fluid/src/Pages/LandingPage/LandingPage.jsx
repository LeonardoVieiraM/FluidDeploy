import "./LandingPage.css";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <main className="container">
      <section className="card glass">
        <img src="/logo.png" alt="Logo Fluid" className="logo" />
        <p className="tagline">
          Converse sem fronteiras. Tradução automática, experiência única.
        </p>
        <div className="cta">
          <Link className="btn primary" to="/login">
            Entrar
          </Link>
          <Link className="btn primary" to="/cadastro">
            Cadastre-se
          </Link>
        </div>
        <div className="features">
          <div className="feature">
            <div className="dot"></div>
            Multilíngue em tempo real
          </div>
          <div className="feature">
            <div className="dot"></div>
            Chats privados e seguros
          </div>
          <div className="feature">
            <div className="dot"></div>
            Interface simples e fluida
          </div>
        </div>
      </section>
      <footer>
        <small>
          © {new Date().getFullYear()} Fluid • Todos os direitos reservados
        </small>
      </footer>
    </main>
  );
};

export default LandingPage;

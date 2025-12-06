import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import PaletteIcon from "@mui/icons-material/Palette";
import "./menuLateral.css";

export default function NavigationRail({
  isRailExtended,
  onToggleRail,
  onLogout,
  operationLoading = false,
  currentChatTheme,
  onChatThemeChange,
}) {
  const location = useLocation();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    onLogout();
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const isActive = (path) => location.pathname === path;

  const handleThemeChange = (theme) => {
    setShowThemeSelector(false);
    onChatThemeChange(theme);
    localStorage.setItem("app-theme", theme);
  };

  const toggleThemeSelector = () => {
    setShowThemeSelector(!showThemeSelector);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (showThemeSelector) {
        setShowThemeSelector(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showThemeSelector]);

  return (
    <>
      <aside className={`nav-sidebar ${isRailExtended ? "rail-extended" : ""}`}>
        <div className="top-icons">
          <button
            className="nav-icon"
            onClick={onToggleRail}
            title={isRailExtended ? "Recolher menu" : "Expandir menu"}
            disabled={operationLoading}
          >
            <MenuIcon />
            {isRailExtended && <span className="nav-text">Menu</span>}
          </button>

          <Link
            className={`nav-icon ${isActive("/chat") ? "active" : ""}`}
            to="/chat"
            title="Conversas"
          >
            <ChatBubbleOutlineIcon />
            {isRailExtended && <span className="nav-text">Chat</span>}
          </Link>

          <Link
            className={`nav-icon ${isActive("/contato") ? "active" : ""}`}
            to="/contato"
            title="Contatos"
          >
            <GroupOutlinedIcon />
            {isRailExtended && <span className="nav-text">Contatos</span>}
          </Link>
        </div>

        <div className="bottom-icons">
          <div className="theme-selector">
            <button
              className={`nav-icon ${showThemeSelector ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleThemeSelector();
              }}
              title="Mudar tema"
              disabled={operationLoading}
            >
              <PaletteIcon />
              {isRailExtended && <span className="nav-text">Tema</span>}
            </button>

            {showThemeSelector && (
              <div
                className={`theme-palette ${
                  isRailExtended ? "rail-extended" : "rail-compact"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  { id: "default", color: "#7c86ff" },
                  { id: "cyan", color: "#00BCD4" },
                  { id: "red", color: "#F44336" },
                  { id: "green", color: "#4CAF50" },
                  { id: "yellow", color: "#ffca28" },
                  { id: "orange", color: "#ff8c00ff" },
                  { id: "pink", color: "#ec407a" },
                  { id: "purple", color: "#9C27B0" },
                ].map((theme) => (
                  <button
                    key={theme.id}
                    className={`theme-option ${
                      currentChatTheme === theme.id ? "active" : ""
                    }`}
                    data-theme={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    title={theme.name}
                    style={{ backgroundColor: theme.color }}
                  >
                    {!isRailExtended && (
                      <span className="theme-tooltip">{theme.name}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            className={`nav-icon ${isActive("/perfil") ? "active" : ""}`}
            to="/perfil"
            title="Perfil"
          >
            <PersonOutlineIcon />
            {isRailExtended && <span className="nav-text">Perfil</span>}
          </Link>

          <button
            className="nav-icon"
            onClick={handleLogoutClick}
            title="Sair"
            disabled={operationLoading}
          >
            <LogoutIcon />
            {isRailExtended && <span className="nav-text">Sair</span>}
          </button>
        </div>
      </aside>

      {showLogoutModal && (
        <div className="modal-overlay" onClick={cancelLogout}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar Saída</h3>
            <p>Tem certeza que deseja sair da sua conta?</p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={cancelLogout}
                disabled={operationLoading}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmLogout}
                disabled={operationLoading}
              >
                {operationLoading ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
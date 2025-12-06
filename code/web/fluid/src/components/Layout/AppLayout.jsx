import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import NavigationRail from "../menuLateral/menuLateral";
import "./AppLayout.css";

const themes = {
  default: {
    "--bg": "#0b0f2a",
    "--panel": "#0e1435",
    "--panel-2": "#0c1230",
    "--stroke": "#8ea0ff",
    "--stroke-strong": "#7c86ff",
    "--text": "#d8e4ff",
    "--muted": "#a9b8ee",
  },
  green: {
    "--bg": "#0a1f17",
    "--panel": "#0d2b20",
    "--panel-2": "#0b251b",
    "--stroke": "#6bbf8a",
    "--stroke-strong": "#4CAF50",
    "--text": "#d4f5e0",
    "--muted": "#9bd4b0",
  },
  purple: {
    "--bg": "#1a0f2a",
    "--panel": "#231535",
    "--panel-2": "#1e1230",
    "--stroke": "#ba68c8",
    "--stroke-strong": "#9C27B0",
    "--text": "#f0d4f5",
    "--muted": "#d49bd4",
  },
  orange: {
    "--bg": "#2a1a0f",
    "--panel": "#352215",
    "--panel-2": "#301c12",
    "--stroke": "#ffb74d",
    "--stroke-strong": "#FF9800",
    "--text": "#f5e4d4",
    "--muted": "#d4b99b",
  },
  red: {
    "--bg": "#2a0f0f",
    "--panel": "#351515",
    "--panel-2": "#301212",
    "--stroke": "#ef5350",
    "--stroke-strong": "#F44336",
    "--text": "#f5d4d4",
    "--muted": "#d49b9b",
  },
  cyan: {
    "--bg": "#0f262a",          
    "--panel": "#153035",       
    "--panel-2": "#122b30",     
    "--stroke": "#4dd0e1",      
    "--stroke-strong": "#00BCD4", 
    "--text": "#d4f5f5",        
    "--muted": "#9bd4d4",       
  },
  pink: {
    "--bg": "#1f0c16",
    "--panel": "#331021",
    "--panel-2": "#290d1b",
    "--stroke": "#f48fb1",
    "--stroke-strong": "#ec407a",
    "--text": "#fce4ec",
    "--muted": "#f8bbd0",
  },
  yellow: {
    "--bg": "#1c1808",
    "--panel": "#332b0e",
    "--panel-2": "#29220b",
    "--stroke": "#ffe082",         
    "--stroke-strong": "#ffca28", 
    "--text": "#fff8e1",           
    "--muted": "#ffecb3",          
  },
};

export default function AppLayout({ children, className = "" }) {
  const [isRailExtended, setIsRailExtended] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [chatTheme, setChatTheme] = useState(() => {
    return localStorage.getItem("app-theme") || "default";
  });
  
  const [contentStyle, setContentStyle] = useState({});

  useEffect(() => {
    let themeToApply = themes.default;

    if (location.pathname.includes("/chat")) {
      themeToApply = themes[chatTheme] || themes.default;
    }

    const style = {};
    Object.entries(themeToApply).forEach(([property, value]) => {
      style[property] = value;
    });

    const glowValue = `0 0 0 1px ${themeToApply["--stroke-strong"]}, 0 0 24px ${themeToApply["--stroke-strong"]}40`;
    style["--glow"] = glowValue;

    setContentStyle(style);
  }, [location.pathname, chatTheme]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleToggleRail = () => {
    setIsRailExtended(!isRailExtended);
  };

  return (
    <div
      className={`app-layout ${isRailExtended ? "rail-extended" : ""} ${className}`}
    >
      <NavigationRail
        isRailExtended={isRailExtended}
        onToggleRail={handleToggleRail}
        onLogout={handleLogout}
        currentChatTheme={chatTheme}
        onChatThemeChange={setChatTheme}
      />
      <div className="app-content" style={contentStyle}>
        {children}
      </div>
    </div>
  );
}
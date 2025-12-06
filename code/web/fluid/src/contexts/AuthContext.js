import { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  const API_BASE = "http://localhost:3001/api";

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_BASE}/usuarios/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem("token");
        setToken(null);
      }
    } catch (error) {
      console.error("Erro ao verificar token:", error);
      localStorage.removeItem("token");
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/usuarios/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, senha: password }),
      });

      const data = await response.json();

      if (response.ok) {
        const { token, usuario } = data;
        localStorage.setItem("token", token);
        setToken(token);
        setUser(usuario);
        return { success: true, user: usuario };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: "Erro de conexão com o servidor" };
    }
  };

  const cadastrar = async (userData) => {
    try {
      const backendData = {
        nome: userData.name,
        email: userData.email,
        senha: userData.password,
        numeroTelefone: userData.phone
          ? userData.phone.replace(/\D/g, "")
          : null,
        idiomaPadrao: "pt-BR",
      };

      const response = await fetch(`${API_BASE}/usuarios/cadastrar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(backendData),
      });

      const data = await response.json();

      if (response.ok) {
        const loginResult = await login(userData.email, userData.password);
        return loginResult;
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: "Erro de conexão com o servidor" };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await fetch(`${API_BASE}/usuarios/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.usuario);
        return { success: true, user: data.usuario };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: "Erro de conexão com o servidor" };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    cadastrar,
    logout,
    updateProfile,
    isAuthenticated: !!token,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

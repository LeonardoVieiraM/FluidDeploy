const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const API_ENDPOINTS = {
  USUARIOS: {
    CADASTRAR: `${API_BASE_URL}/usuarios/cadastrar`,
    LOGIN: `${API_BASE_URL}/usuarios/login`,
    ALTERAR_STATUS: (id) => `${API_BASE_URL}/usuarios/${id}/status`,
    ALTERAR_IDIOMA: (id) => `${API_BASE_URL}/usuarios/${id}/idioma`,
  }
};

export default API_BASE_URL;
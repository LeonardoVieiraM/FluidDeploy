import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './Pages/LandingPage/LandingPage';
import LoginPage from './Pages/LoginPage/LoginPage';
import SignInPage from './Pages/SignInPage/SignInPage';
import PerfilPage from './Pages/PerfilPage/PerfilPage';
import ChatPage from './Pages/ChatPage/ChatPage';
import ContactPage from './Pages/ContactPage/ContactPage';
import './styles.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<SignInPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path='/chat' element={<ChatPage/>}/>
          <Route path='/contato' element={<ContactPage/>}/>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
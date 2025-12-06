const express = require('express');
const router = express.Router();
const translationService = require('../services/translationService');
const auth = require('../middlewares/auth');

// Translate text
router.post('/translate', auth, async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Texto e idioma alvo são obrigatórios' });
    }

    const result = await translationService.translate(text, { sourceLang, targetLang });
    
    res.json(result);
  } catch (error) {
    console.error('Erro na tradução:', error);
    res.status(500).json({ error: 'Erro ao traduzir texto' });
  }
});

// Detect language
router.post('/detect', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Texto é obrigatório' });
    }

    const result = await translationService.detectLanguage(text);
    
    res.json(result);
  } catch (error) {
    console.error('Erro na detecção de idioma:', error);
    res.status(500).json({ error: 'Erro ao detectar idioma' });
  }
});

// Get supported languages
router.get('/languages', auth, async (req, res) => {
  try {
    const languages = await translationService.getSupportedLanguages();
    
    res.json({ languages });
  } catch (error) {
    console.error('Erro ao buscar idiomas suportados:', error);
    res.status(500).json({ error: 'Erro ao buscar idiomas suportados' });
  }
});

module.exports = router;
const { IDIOMAS_SUPORTADOS, STATUS } = require('../../constants');

const validateUserRegistration = (req, res, next) => {
    const { nome, email, senha, idiomaPadrao } = req.body;

    if (!nome || nome.trim().length < 2) {
        return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    if (!senha || senha.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    if (idiomaPadrao && !IDIOMAS_SUPORTADOS.includes(idiomaPadrao)) {
        return res.status(400).json({ 
            error: `Idioma não suportado. Idiomas disponíveis: ${IDIOMAS_SUPORTADOS.join(', ')}` 
        });
    }

    next();
};

const validateMessage = (req, res, next) => {
    const { recipientId, text } = req.body;

    if (!recipientId) {
        return res.status(400).json({ error: 'ID do destinatário é obrigatório' });
    }

    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Texto da mensagem é obrigatório' });
    }

    if (text.length > 5000) {
        return res.status(400).json({ error: 'Mensagem muito longa' });
    }

    next();
};

const validateContact = (req, res, next) => {
    const { contatoId, numeroTelefone } = req.body;

    if (!contatoId && !numeroTelefone) {
        return res.status(400).json({ 
            error: 'ID do contato ou número de telefone é obrigatório' 
        });
    }

    next();
};

module.exports = {
    validateUserRegistration,
    validateMessage,
    validateContact
};
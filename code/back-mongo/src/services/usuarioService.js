const { User } = require("../models");
const bcrypt = require("bcrypt");
const { IDIOMAS_SUPORTADOS } = require("../../constants");
const { normalizeEmail, normalizePhone } = require("../utils/sanitize");
const { pickUserPublicFields } = require("../utils/sanitize");
const imageService = require("./imageService");

class UsuarioService {
  async atualizarImagemPerfil(userId, imageBuffer, mimeType) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    try {
      const imageId = await imageService.uploadProfileImage(
        userId,
        imageBuffer,
        mimeType
      );

      if (!imageId) {
        throw new Error("Falha no upload da imagem - ID não retornado");
      }

      const result = await User.updateProfileImageId(userId, imageId);
      if (result.modifiedCount === 0) {
        throw new Error("Falha ao atualizar imagem de perfil no usuário");
      }

      const updatedUser = await User.findById(userId);
      if (!updatedUser) {
        throw new Error("Usuário não encontrado após atualização");
      }

      return updatedUser;
    } catch (error) {
      console.error("Error in atualizarImagemPerfil:", error);
      throw new Error(`Erro ao atualizar imagem de perfil: ${error.message}`);
    }
  }

  async cadastrar(dadosUsuario) {
    const { nome, email, numeroTelefone, senha, idiomaPadrao } = dadosUsuario;

    const emailNorm = normalizeEmail(email);
    const usuarioExistente = await User.findByEmail(emailNorm);
    if (usuarioExistente) {
      throw new Error("Email já cadastrado");
    }

    if (numeroTelefone) {
      const phoneNorm = normalizePhone(numeroTelefone);
      const phoneExistente = await User.findByPhone(phoneNorm);
      if (phoneExistente) {
        throw new Error("Número de telefone já cadastrado");
      }
    }

    const created = await User.create({
      nome,
      email: emailNorm,
      numeroTelefone: numeroTelefone ? normalizePhone(numeroTelefone) : null,
      senha,
      idiomaPadrao: idiomaPadrao || "pt-BR",
    });

    if (numeroTelefone !== undefined && numeroTelefone !== null) {
      if (typeof numeroTelefone === "number") {
        try {
          created.numeroTelefone = Number(created.numeroTelefone);
        } catch (e) {
        }
      }
    }

    return created;
  }

  async login(email, senha) {
    const emailNorm = normalizeEmail(email);
    const usuario = await User.findByEmail(emailNorm);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw new Error("Senha inválida");
    }

    await User.updateStatus(usuario._id, "online");
    return await User.findById(usuario._id);
  }

  async alterarStatus(userId, status) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    const result = await User.updateStatus(userId, status);
    if (result.modifiedCount === 0) {
      throw new Error("Falha ao atualizar status");
    }

    return await User.findById(userId);
  }

  async alterarIdioma(userId, idioma) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    if (!IDIOMAS_SUPORTADOS.includes(idioma)) {
      throw new Error(
        `Idioma não suportado. Idiomas disponíveis: ${IDIOMAS_SUPORTADOS.join(
          ", "
        )}`
      );
    }

    const result = await User.updateLanguage(userId, idioma);
    if (result.modifiedCount === 0) {
      throw new Error("Falha ao atualizar idioma");
    }

    return await User.findById(userId);
  }

  async buscarUsuarios({ searchParams, limit = 20, offset = 0 }) {
    if (searchParams === undefined || searchParams === null) {
      throw new Error(
        "Forneça pelo menos um critério: telefone, email ou nome"
      );
    }

    const params = { ...(searchParams || {}) };
    if (params.numeroTelefone !== undefined && params.numeroTelefone !== null) {
      params.numeroTelefone = normalizePhone(params.numeroTelefone);
    }
    if (params.email) {
      params.email = normalizeEmail(params.email);
    }

    const usuarios = await User.searchUsers(params, limit, offset);
    return usuarios.map((u) => ({
      id: u._id,
      nome: u.nome,
      email: u.email,
      numeroTelefone: u.numeroTelefone,
      idiomaPadrao: u.idiomaPadrao,
      status: u.status,
    }));
  }

  async buscarContatos(userId, searchTerm, limit = 20, offset = 0) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    const contatos = await User.getContacts(userId);

    if (!searchTerm) {
      return await this._getContactDetails(contatos);
    }

    const filteredContacts = await this._filterContactsBySearch(
      contatos,
      searchTerm
    );

    return filteredContacts.slice(offset, offset + limit);
  }

  async _getContactDetails(contatos) {
    return await Promise.all(
      contatos.map(async (contact) => {
        const contactUser = await User.findById(contact.contatoId);

        const contactPublic = contactUser
          ? pickUserPublicFields(contactUser)
          : null;

        return {
          id: contact.contatoId.toString(),
          contatoId: contact.contatoId.toString(),
          apelido: contact.apelido,
          contato: contactPublic,
        };
      })
    );
  }

  async adicionarContatoPorTelefone(userId, numeroTelefone, apelido = null) {
    const phoneNorm = normalizePhone(numeroTelefone);
    if (!phoneNorm) {
      throw new Error("Telefone inválido");
    }

    const contato = await User.findByPhone(phoneNorm);
    if (!contato) {
      throw new Error("Usuário com este telefone não encontrado");
    }

    if (userId === contato._id.toString()) {
      throw new Error("Você não pode adicionar a si mesmo como contato");
    }

    const result = await User.addContact(userId, contato._id, apelido);
    if (result.modifiedCount === 0) {
      throw new Error("Falha ao adicionar contato");
    }

    return {
      id: contato._id,
      contatoId: contato._id,
      apelido,
      contato: {
        id: contato._id,
        nome: contato.nome,
        email: contato.email,
        idiomaPadrao: contato.idiomaPadrao,
        status: contato.status,
      },
    };
  }

  async adicionarContatoPorEmail(userId, email, apelido = null) {
    const emailNorm = normalizeEmail(email);
    if (!emailNorm) {
      throw new Error("Email inválido");
    }

    const contato = await User.findByEmail(emailNorm);
    if (!contato) {
      throw new Error("Usuário com este email não encontrado");
    }

    if (userId === contato._id.toString()) {
      throw new Error("Você não pode adicionar a si mesmo como contato");
    }

    const result = await User.addContact(userId, contato._id, apelido);
    if (result.modifiedCount === 0) {
      throw new Error("Falha ao adicionar contato");
    }

    return {
      id: contato._id,
      contatoId: contato._id,
      apelido,
      contato: {
        id: contato._id,
        nome: contato.nome,
        email: contato.email,
        idiomaPadrao: contato.idiomaPadrao,
        status: contato.status,
      },
    };
  }

  async adicionarContato(userId, contatoId, apelido = null) {
    if (userId.toString() === contatoId.toString()) {
      throw new Error("Você não pode adicionar a si mesmo como contato");
    }

    const [usuario, contato] = await Promise.all([
      User.findById(userId),
      User.findById(contatoId),
    ]);

    if (!usuario || !contato) {
      throw new Error("Usuário ou contato não encontrado");
    }

    const result = await User.addContact(userId, contatoId, apelido);
    if (result.modifiedCount === 0) {
      throw new Error("Falha ao adicionar contato");
    }

    return {
      id: contato._id,
      contatoId: contato._id,
      apelido,
      contato: {
        id: contato._id,
        nome: contato.nome,
        email: contato.email,
        idiomaPadrao: contato.idiomaPadrao,
        status: contato.status,
      },
    };
  }

  async removerContato(userId, contatoId) {
    const result = await User.removeContact(userId, contatoId);
    if (result.modifiedCount === 0) {
      throw new Error("Contato não encontrado");
    }
    return { success: true };
  }

  async listarContatos(userId) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    const contatos = await User.getContacts(userId);

    const contactDetails = await Promise.all(
      contatos.map(async (contact) => {
        const contactUser = await User.findById(contact.contatoId);

        const contactPublic = contactUser
          ? pickUserPublicFields(contactUser)
          : null;

        return {
          id: contact.contatoId.toString(),
          contatoId: contact.contatoId.toString(),
          apelido: contact.apelido,
          contato: contactPublic,
        };
      })
    );

    return contactDetails;
  }

  async editarApelido(userId, contatoId, apelido) {
    const result = await User.updateContactNickname(userId, contatoId, apelido);
    if (result.modifiedCount === 0) {
      throw new Error("Contato não encontrado");
    }
    return { success: true };
  }

  async obterPerfil(userId) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    const userObj = usuario.toObject ? usuario.toObject() : { ...usuario };
    userObj.hasProfileImage = !!usuario.profileImageId;

    return userObj;
  }

  async atualizarPerfil(userId, dados) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    const updateData = {};

    if (dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length < 2) {
        throw new Error("Nome deve ter pelo menos 2 caracteres");
      }
      updateData.nome = dados.nome.trim();
    }

    if (dados.email !== undefined) {
      const emailNorm = normalizeEmail(dados.email);
      if (!emailNorm) {
        throw new Error("Email inválido");
      }

      const emailExistente = await User.findByEmail(emailNorm);
      if (emailExistente && emailExistente._id.toString() !== userId) {
        throw new Error("Este email já está em uso");
      }
      updateData.email = emailNorm;
    }

    if (dados.numeroTelefone !== undefined) {
      const phoneNorm = normalizePhone(dados.numeroTelefone);
      if (phoneNorm) {
        const telefoneExistente = await User.findByPhone(phoneNorm);
        if (telefoneExistente && telefoneExistente._id.toString() !== userId) {
          throw new Error("Este telefone já está em uso");
        }
        updateData.numeroTelefone = phoneNorm;
      } else {
        updateData.numeroTelefone = null;
      }
    }

    if (dados.status !== undefined) {
      updateData.status = dados.status;
    }

    if (dados.mensagemRecado !== undefined) {
      if (dados.mensagemRecado.length > 100) {
        throw new Error(
          "A mensagem de recado não pode ter mais de 100 caracteres"
        );
      }
      updateData.mensagemRecado = dados.mensagemRecado;
    }

    const result = await User.updateProfile(userId, updateData);
    if (result.modifiedCount === 0) {
      throw new Error("Nenhuma alteração foi realizada");
    }

    return await User.findById(userId);
  }

  async alterarSenha(userId, senhaAtual, novaSenha) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      throw new Error("Senha atual incorreta");
    }

    if (!novaSenha || novaSenha.length < 6) {
      throw new Error("A nova senha deve ter pelo menos 6 caracteres");
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);
    const result = await User.updatePassword(userId, novaSenhaHash);

    if (result.modifiedCount === 0) {
      throw new Error("Falha ao alterar senha");
    }

    return { success: true, message: "Senha alterada com sucesso" };
  }

  async atualizarRecado(userId, mensagemRecado) {
    const usuario = await User.findById(userId);
    if (!usuario) {
      throw new Error("Usuário não encontrado");
    }

    if (mensagemRecado && mensagemRecado.length > 100) {
      throw new Error(
        "A mensagem de recado não pode ter mais de 100 caracteres"
      );
    }

    const result = await User.updateRecado(userId, mensagemRecado);
    if (result.modifiedCount === 0) {
      throw new Error("Falha ao atualizar mensagem de recado");
    }

    return await User.findById(userId);
  }
}

module.exports = new UsuarioService();

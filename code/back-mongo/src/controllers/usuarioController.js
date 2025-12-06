const usuarioService = require("../services/usuarioService");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { normalizeEmail, pickUserPublicFields } = require("../utils/sanitize");
const imageService = require("../services/imageService");
const { User } = require("../models");

class UsuarioController {
  async uploadImagemPerfil(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhuma imagem enviada." });
      }

      if (!req.file.buffer || req.file.buffer.length === 0) {
        return res
          .status(400)
          .json({ error: "Arquivo de imagem vazio ou corrompido." });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: "Arquivo muito grande. Tamanho máximo: 5MB." });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res
          .status(400)
          .json({ error: "Apenas arquivos de imagem são permitidos." });
      }

      const usuario = await usuarioService.atualizarImagemPerfil(
        req.userId,
        req.file.buffer,
        req.file.mimetype
      );

      res.json({
        message: "Imagem de perfil atualizada com sucesso.",
        usuario: pickUserPublicFields(usuario),
        imageId: usuario.profileImageId,
      });
    } catch (error) {
      console.error("Erro ao enviar imagem de perfil:", error);
      console.error("Stack trace:", error.stack);

      const errorMessage = error.message.includes("ID não retornado")
        ? "Erro no servidor ao processar a imagem. Tente novamente."
        : error.message;

      res.status(400).json({ error: errorMessage });
    }
  }

  async getImagemPerfil(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        console.log(`User not found: ${userId}`);
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const imageId = user.profileImageId;

        if (!imageId) {
          const { DEFAULT_PROFILE_IMAGE_PATH } = require('../../defaultProfileImage');
          return res.sendFile(DEFAULT_PROFILE_IMAGE_PATH);
        }


      const file = await imageService.getProfileImage(userId);
      if (!file) {
        console.log(`GridFS file not found for user ${userId}`);
        return res.status(404).json({ error: "Imagem não encontrada" });
      }

      res.set({
        "Content-Type": file.contentType,
        "Content-Length": file.length,
        "Cache-Control": "public, max-age=86400",
        ETag: file._id.toString(),
      });

      const downloadStream = await imageService.getImageStream(file._id);

      downloadStream.on("error", (error) => {
        console.error("Stream error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Erro ao carregar imagem" });
        }
      });

      downloadStream.pipe(res);
    } catch (error) {
      console.error("Erro ao buscar imagem de perfil:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erro ao carregar imagem" });
      }
    }
  }

  async cadastrar(req, res) {
    try {
      const { nome, email, numeroTelefone, senha, idiomaPadrao } = req.body;
      const usuario = await usuarioService.cadastrar({
        nome,
        email,
        numeroTelefone,
        senha,
        idiomaPadrao,
      });
      res.status(201).json(pickUserPublicFields(usuario));
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, senha } = req.body;
      const usuario = await usuarioService.login(email, senha);

      const token = jwt.sign(
        { userId: usuario._id.toString() },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({
        message: "Login realizado com sucesso",
        token,
        usuario: pickUserPublicFields(usuario),
      });
    } catch (error) {
      console.error("Erro no login:", error);
      res.status(401).json({ error: error.message });
    }
  }

  async alterarStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const usuario = await usuarioService.alterarStatus(id, status);
      res.json({
        message: "Status atualizado com sucesso",
        usuario: pickUserPublicFields(usuario),
      });
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async alterarIdioma(req, res) {
    try {
      const { id } = req.params;
      const { idioma } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const usuario = await usuarioService.alterarIdioma(id, idioma);
      res.json({
        message: "Idioma atualizado com sucesso",
        usuario: pickUserPublicFields(usuario),
      });
    } catch (error) {
      console.error("Erro ao alterar idioma:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async adicionarContato(req, res) {
    try {
      const { id } = req.params;
      const { contatoId, apelido } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const registro = await usuarioService.adicionarContato(
        req.userId,
        contatoId,
        apelido
      );
      res.status(201).json(registro);
    } catch (error) {
      console.error("Erro ao adicionar contato:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async removerContato(req, res) {
    try {
      const { id, contatoId } = req.params;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const result = await usuarioService.removerContato(req.userId, contatoId);
      res.json(result);
    } catch (error) {
      console.error("Erro ao remover contato:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async listarContatos(req, res) {
    try {
      const { id } = req.params;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const itens = await usuarioService.listarContatos(req.userId);
      res.json(itens);
    } catch (error) {
      console.error("Erro ao listar contatos:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async buscarUsuarios(req, res) {
    try {
      const { telefone, email, nome, q, limit = 20, offset = 0 } = req.query;
      const currentUserId = req.userId;

      const searchParams = {};

      if (q) {
        searchParams.$or = [
          { nome: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { numeroTelefone: { $regex: q, $options: "i" } },
        ];
      } else {
        if (telefone) searchParams.numeroTelefone = telefone;
        if (email) searchParams.email = email;
        if (nome) searchParams.nome = nome;
      }

      if (currentUserId) {
        searchParams._id = { $ne: currentUserId };
      }

      if (Object.keys(searchParams).length === 0) {
        return res.status(400).json({
          error: "Forneça pelo menos um critério: telefone, email ou nome",
        });
      }

      const itens = await usuarioService.buscarUsuarios({
        searchParams,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
      res.json(itens);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async buscarContatos(req, res) {
    try {
      const { id } = req.params;
      const { q, limit = 20, offset = 0 } = req.query;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const itens = await usuarioService.buscarContatosPorApelido(
        req.userId,
        q,
        parseInt(limit),
        parseInt(offset)
      );
      res.json(itens);
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async adicionarContatoPorTelefone(req, res) {
    try {
      const { id } = req.params;
      const { numeroTelefone, apelido } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const registro = await usuarioService.adicionarContatoPorTelefone(
        req.userId,
        numeroTelefone,
        apelido
      );
      res.status(201).json(registro);
    } catch (error) {
      console.error("Erro ao adicionar contato por telefone:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async adicionarContatoPorEmail(req, res) {
    try {
      const { id } = req.params;
      const { email, apelido } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const registro = await usuarioService.adicionarContatoPorEmail(
        req.userId,
        email,
        apelido
      );
      res.status(201).json(registro);
    } catch (error) {
      console.error("Erro ao adicionar contato por email:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async editarApelidoContato(req, res) {
    try {
      const { id, contatoId } = req.params;
      const { apelido } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const result = await usuarioService.editarApelido(
        req.userId,
        contatoId,
        apelido
      );
      res.json(result);
    } catch (error) {
      console.error("Erro ao editar apelido:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async obterPerfil(req, res) {
    try {
      const usuario = await usuarioService.obterPerfil(req.userId);
      res.json(pickUserPublicFields(usuario));
    } catch (error) {
      console.error("Erro ao obter perfil:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async atualizarPerfil(req, res) {
    try {
      const { nome, email, numeroTelefone, status, mensagemRecado } = req.body;
      const usuario = await usuarioService.atualizarPerfil(req.userId, {
        nome,
        email,
        numeroTelefone,
        status,
        mensagemRecado,
      });
      res.json({
        message: "Perfil atualizado com sucesso",
        usuario: pickUserPublicFields(usuario),
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async alterarSenha(req, res) {
    try {
      const { id } = req.params;
      const { senhaAtual, novaSenha } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const result = await usuarioService.alterarSenha(
        req.userId,
        senhaAtual,
        novaSenha
      );
      res.json(result);
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      res.status(400).json({ error: error.message });
    }
  }

  async atualizarRecado(req, res) {
    try {
      const { id } = req.params;
      const { mensagemRecado } = req.body;

      if (id !== req.userId) {
        return res.status(403).json({ error: "Operação não permitida" });
      }

      const usuario = await usuarioService.atualizarRecado(
        req.userId,
        mensagemRecado
      );
      res.json({
        message: "Mensagem de recado atualizada com sucesso",
        usuario: pickUserPublicFields(usuario),
      });
    } catch (error) {
      console.error("Erro ao atualizar recado:", error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new UsuarioController();

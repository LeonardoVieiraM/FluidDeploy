const express = require("express");
const router = express.Router();
const usuarioController = require("../controllers/usuarioController");
const {
  validateUserRegistration,
  validateContact,
} = require("../middlewares/validation");
const auth = require("../middlewares/auth");
const { IDIOMAS_SUPORTADOS } = require("../../constants");
const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../imagens"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas imagens são permitidas"), false);
    }
  },
});

// Public routes
router.post(
  "/cadastrar",
  validateUserRegistration,
  usuarioController.cadastrar
);
// Upload de imagem de perfil
router.post(
  "/me/imagem",
  auth,
  upload.single("imagem"),
  usuarioController.uploadImagemPerfil
);
router.get("/:userId/imagem-perfil", usuarioController.getImagemPerfil);

router.post("/login", usuarioController.login);

// Idiomas suportados
router.get("/idiomas/suportados", (req, res) => {
  res.json({ idiomas: IDIOMAS_SUPORTADOS });
});

// Protected routes
router.get("/me", auth, usuarioController.obterPerfil);
router.put("/me", auth, usuarioController.atualizarPerfil);

// User management
router.put("/:id/status", auth, usuarioController.alterarStatus);
router.put("/:id/idioma", auth, usuarioController.alterarIdioma);
router.put("/:id/senha", auth, usuarioController.alterarSenha);
router.put("/:id/recado", auth, usuarioController.atualizarRecado);

// Search
router.get("/busca", auth, usuarioController.buscarUsuarios);

// Contacts
router.post(
  "/:id/contatos",
  auth,
  validateContact,
  usuarioController.adicionarContato
);
router.delete(
  "/:id/contatos/:contatoId",
  auth,
  usuarioController.removerContato
);
router.get("/:id/contatos", auth, usuarioController.listarContatos);
router.post(
  "/:id/contatos/por-telefone",
  auth,
  usuarioController.adicionarContatoPorTelefone
);
router.patch(
  "/:id/contatos/:contatoId",
  auth,
  usuarioController.editarApelidoContato
);
router.post(
  "/:id/contatos/por-email",
  auth,
  usuarioController.adicionarContatoPorEmail
);
router.get("/:id/contatos/busca", auth, usuarioController.buscarContatos);

module.exports = router;

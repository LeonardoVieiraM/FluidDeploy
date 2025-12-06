const express = require("express");
const multer = require("multer");
const imageService = require("../services/imageService");
const auth = require("../middlewares/auth");

const router = express.Router();

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (/^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/i.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Tipo de arquivo não suportado. Envie apenas imagens."),
      false
    );
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// POST /api/uploads - Store chat images in GridFS
router.post("/", auth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Upload to GridFS
    const fileId = await imageService.uploadChatImage(
      userId,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    const payload = {
      attachment: {
        fileId: fileId.toString(),
        url: `/api/uploads/${fileId}`,
        mime: req.file.mimetype,
        size: req.file.size,
        width: null,
        height: null,
        thumbUrl: null,
        originalName: req.file.originalname,
      },
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Erro no upload da imagem do chat:", err);
    return res.status(500).json({
      error: "Falha no upload da imagem",
      details: err.message,
    });
  }
});

// POST /api/uploads/group-profile - Upload de imagem de perfil para grupo
router.post("/group-profile", auth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada" });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Upload da imagem do grupo para GridFS
    const fileId = await imageService.uploadGroupProfileImage(
      userId,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    const payload = {
      success: true,
      fileId: fileId.toString(),
      url: `/api/uploads/${fileId}`,
      mime: req.file.mimetype,
      size: req.file.size,
      originalName: req.file.originalname,
      message: "Imagem do grupo enviada com sucesso"
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Erro no upload da imagem do grupo:", err);
    return res.status(500).json({
      error: "Falha no upload da imagem do grupo",
      details: err.message,
    });
  }
});

// GET /api/uploads/:fileId - Retrieve chat image from GridFS
router.get("/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({ error: "ID do arquivo não fornecido" });
    }

    // Get file info first to set headers properly
    let fileInfo;
    try {
      fileInfo = await imageService.getChatImage(fileId);
    } catch (error) {
      console.error("Erro ao obter informações da imagem:", error);
      if (error.message.includes("Image not found")) {
        return res.status(404).json({ error: "Imagem não encontrada" });
      }
      return res.status(500).json({ error: "Erro ao recuperar imagem" });
    }

    // Set headers before streaming
    res.set("Content-Type", fileInfo.contentType || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.set("Content-Length", fileInfo.length);

    const stream = await imageService.getImageStream(fileId);

    stream.on("error", (error) => {
      console.error("Erro no stream da imagem:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao recuperar imagem" });
      }
    });

    stream.pipe(res);

    req.on("close", () => {
      if (stream.destroy) {
        stream.destroy();
      }
    });
  } catch (error) {
    console.error("Erro no endpoint de recuperação de imagem:", error);

    if (!res.headersSent) {
      if (
        error.message.includes("Invalid image ID format") ||
        error.message.includes("Image not found")
      ) {
        return res.status(404).json({ error: "Imagem não encontrada" });
      }
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
});

module.exports = router;

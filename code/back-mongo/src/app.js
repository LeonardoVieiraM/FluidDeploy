const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

const mongodb = require("./config/database-mongodb");

const usuarioRoutes = require("./routes/usuarioRoutes");
const mensagemRoutes = require("./routes/mensagemRoutes");
const conversaRoutes = require("./routes/conversaRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
      },
    },
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: "Muitas requisições deste IP, tente novamente mais tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Muitas tentativas de autenticação, tente novamente em 15 minutos.",
  },
});

app.use(compression());

app.use(
  cors({
    origin: function (origin, callback) {
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://fluid-deploy.vercel.app",
        "https://fluid-deploy.vercel.app/",
        "https://plf-es-2025-2-ti5-0492100-fluid-production.up.railway.app",
      ];
      if (!origin || allowedOrigins.indexOf(origin) !== -1)
        callback(null, true);
      else callback(new Error("Não permitido por CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Cache-Control",
      "Pragma",
      "Expires",
    ],
  })
);

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(limiter);

app.use("/health", (req, res, next) => {
  req.rateLimit = true;
  next();
});

app.get("/health", async (req, res) => {
  try {
    const dbHealth = await mongodb.healthCheck();
    const status = dbHealth.status === "OK" ? 200 : 503;
    res.status(status).json({
      status: dbHealth.status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "1.0.0",
      services: {
        database: dbHealth,
        websocket: { status: "OK" },
        rabbitmq: { status: "OK" },
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: "Serviço indisponível",
      details: error.message,
    });
  }
});

app.get("/test-db", async (req, res) => {
  try {
    const db = await mongodb.connect();
    const collections = await db.listCollections().toArray();
    res.json({
      success: true,
      message: "Conexão com o banco de dados estabelecida com sucesso",
      database: process.env.DB_NAME || "chat_app",
      collections: collections.map((c) => ({ name: c.name, type: c.type })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Falha na conexão com o banco de dados",
      details: error.message,
    });
  }
});

app.get("/api/info", (req, res) => {
  res.json({
    name: "Chat App API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    features: [
      "Autenticação JWT",
      "Mensagens em tempo real",
      "Tradução automática",
      "WebSocket integrado",
      "MongoDB + RabbitMQ",
    ],
    endpoints: {
      auth: "/api/usuarios",
      messages: "/api/mensagens",
      conversations: "/api/conversas",
      uploads: "/api/uploads",
      websocket: "/ws",
    },
  });
});

app.use("/api/usuarios/login", authLimiter);
app.use("/api/usuarios/cadastrar", authLimiter);

app.use("/imagens", express.static(path.join(__dirname, "..", "imagens")));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

console.log("STATIC /uploads ->", path.join(__dirname, "uploads"));

app.use("/api/usuarios", usuarioRoutes);
app.use("/api/mensagens", mensagemRoutes);
app.use("/api/conversas", conversaRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/translation", require("./routes/translationRoutes"));

app.use("*", (req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error("Erro não tratado:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    body: req.body,
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Dados de entrada inválidos",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      error: "Conflito de dados",
      details: `${field} já está em uso`,
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Token inválido" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "Token expirado" });
  }

  const statusCode = err.status || err.statusCode || 500;
  const response = {
    error: err.message || "Erro interno do servidor",
    timestamp: new Date().toISOString(),
  };
  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
    response.details = err.details;
  }
  res.status(statusCode).json(response);
});

module.exports = app;

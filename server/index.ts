import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Resolver rutas estáticas compatible tanto con desarrollo (tsx) como producción compilada (dist/server)
function resolveStaticPath(folderName: string): string {
  const candidates = [
    path.join(process.cwd(), folderName),
    path.join(__dirname, "..", folderName),
    path.join(__dirname, "../..", folderName),
    path.join(__dirname, folderName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), folderName);
}

const publicPath = resolveStaticPath("public");
const slidesPath = resolveStaticPath("slides");

console.log(`📁 Ruta public resuelta: ${publicPath}`);
console.log(`📁 Ruta slides resuelta: ${slidesPath}`);

// Middlewares
app.use(cors());
app.use(express.json());

// Servir la aplicación web interactiva
app.use(express.static(publicPath));

// Servir las diapositivas de la presentación Reveal.js en /slides
app.use("/slides", express.static(slidesPath));

// Rutas explícitas para asegurar carga directa de ambos endpoints/vistas
app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/slides", (_req: Request, res: Response) => {
  res.sendFile(path.join(slidesPath, "index.html"));
});

// Health check para Docker / orquestadores
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Endpoint de Chat con Server-Sent Events (SSE)
app.post("/api/chat", async (req: Request, res: Response) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "El campo 'prompt' es requerido y debe ser texto no vacío." });
  }

  // Headers requeridos para Server-Sent Events (SSE)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Control de desconexión del cliente
  let isClientConnected = true;
  req.on("close", () => {
    isClientConnected = false;
  });

  // Respuesta simulada demostrando el flujo de streaming en un LLM
  const sanitizedPrompt = prompt.trim();
  const responseText = `¡Hola! Recibí tu mensaje: "${sanitizedPrompt}". Como arquitecto de software, te sugiero estructurar tus microservicios web utilizando JavaScript y flujos asíncronos para optimizar el rendimiento y reducir la latencia percibida (TTFT). ¿En qué más te puedo ayudar hoy?`;

  const words = responseText.split(" ");
  try {
    for (const word of words) {
      if (!isClientConnected) {
        break;
      }
      res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    if (isClientConnected) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error) {
    console.error("Error durante el streaming:", error);
    if (isClientConnected && !res.headersSent) {
      res.status(500).json({ error: "Error interno del servidor durante el streaming." });
    } else if (isClientConnected) {
      res.end();
    }
  }
});

// Inicio del servidor
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor ejecutándose en http://${HOST}:${PORT}`);
  console.log(`💬 Chat App: http://${HOST}:${PORT}/`);
  console.log(`📊 Diapositivas: http://${HOST}:${PORT}/slides`);
});

// Graceful Shutdown
const handleShutdown = (signal: string) => {
  console.log(`Recibida señal ${signal}. Cerrando servidor HTTP...`);
  server.close(() => {
    console.log("Servidor cerrado correctamente.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Cierre forzado tras tiempo de espera agotado.");
    process.exit(1);
  }, 5000);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

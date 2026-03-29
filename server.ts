import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Mock Data Store
  let activeCalls = [
    { id: "lure_1", status: "active", duration: "02:14", riskScore: 92, caller: "Lurer_X", agent: "Wildy_Bot" },
    { id: "phish_2", status: "monitoring", duration: "05:42", riskScore: 15, caller: "GE_Spammer", agent: "Manual" },
  ];

  let alerts = [
    { id: "alert_1", type: "CRITICAL", message: "Wilderness lure detected: 'Anti-lure' script in progress", timestamp: new Date().toISOString() },
    { id: "alert_2", type: "WARNING", message: "Suspicious 'Double XP' link detected in RuneChat", timestamp: new Date().toISOString() },
  ];

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    res.json({
      totalCalls: 4520, // Total interactions
      fraudDetected: 842, // Lures/Scams prevented
      activeMonitoring: activeCalls.length,
      averageRiskScore: 68, // GP risk
    });
  });

  app.get("/api/calls", (req, res) => {
    res.json(activeCalls);
  });

  app.get("/api/alerts", (req, res) => {
    res.json(alerts);
  });

  // Socket.io for real-time updates
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      const update = {
        id: "call_1",
        riskScore: Math.min(100, 85 + Math.floor(Math.random() * 5)),
        duration: "02:" + (14 + Math.floor(Math.random() * 10)).toString().padStart(2, '0')
      };
      socket.emit("call_update", update);
    }, 5000);

    socket.on("disconnect", () => {
      clearInterval(interval);
      console.log("Client disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`FraudSim Lab running on http://localhost:${PORT}`);
  });
}

startServer();

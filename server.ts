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
    { id: "call_1", status: "active", duration: "02:14", riskScore: 85, caller: "+1 555-0101", agent: "AI-PPP-01" },
    { id: "call_2", status: "monitoring", duration: "05:42", riskScore: 12, caller: "+1 555-0202", agent: "Manual" },
  ];

  let alerts = [
    { id: "alert_1", type: "CRITICAL", message: "High risk PPP application detected in call #1", timestamp: new Date().toISOString() },
    { id: "alert_2", type: "WARNING", message: "Unusual VOIP origin detected for caller +1 555-0101", timestamp: new Date().toISOString() },
  ];

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    res.json({
      totalCalls: 124,
      fraudDetected: 18,
      activeMonitoring: activeCalls.length,
      averageRiskScore: 42,
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

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import connectDatabase from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const server = http.createServer(app);

// ────────────────────── CORS ──────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://cafemeetups.com",
  "https://www.cafemeetups.com",
  "https://cafe-meet-ups-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("Blocked by CORS:", origin);
      callback(new Error(`CORS not allowed: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ────────────────────── BODY PARSERS ──────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ────────────────────── DATABASE ──────────────────────
connectDatabase();

// ────────────────────── SOCKET.IO ──────────────────────
const io = new Server(server, {
  cors: corsOptions,
  path: "/socket.io",
});

const onlineUsers = new Map(); // userId → socket.id

// JWT Auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Token required"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);
  console.log(`User ${userId} connected (socket: ${socket.id})`);

  // Broadcast online
  socket.broadcast.emit("user-online", userId);

  // ───── JOIN ALL USER MATCH ROOMS ─────
  (async () => {
    try {
      const Match = (await import("./models/Match.js")).default;
      const matches = await Match.find({ users: userId }).select("_id");
      matches.forEach((m) => socket.join(m._id.toString()));
    } catch (err) {
      console.error("Failed to join rooms:", err);
    }
  })();

  // ───── JOIN SPECIFIC MATCH ROOM ─────
  socket.on("join-match", (matchId) => {
    socket.join(matchId);
    console.log(`User ${userId} joined match: ${matchId}`);
  });

  // ───── SEND MESSAGE ─────
  // ───── SEND MESSAGE ─────
  socket.on("send-message", async ({ matchId, text }) => {
    try {
      const Message = (await import("./models/Message.js")).default;
      const Match = (await import("./models/Match.js")).default;

      const match = await Match.findById(matchId);
      if (!match || !match.users.map(String).includes(userId)) {
        return socket.emit("error", { message: "Unauthorized" });
      }

      const receiverId = match.users.find((id) => id.toString() !== userId);
      const newMsg = new Message({
        matchId,
        senderId: userId,
        receiverId,
        messageText: text,
      });
      await newMsg.save();

      match.lastMessage = { text, sender: userId, timestamp: newMsg.createdAt };
      await match.save();

      // SAME PAYLOAD TO BOTH
      const payload = {
        id: newMsg._id.toString(),
        text: newMsg.messageText,
        senderId: userId, // Only ID
        timestamp: newMsg.createdAt,
        isRead: false,
      };

      // Emit to ENTIRE ROOM (both users)
      io.to(matchId).emit("new-message", payload);

      console.log(`Message broadcast to room ${matchId}: "${text}"`);
    } catch (err) {
      console.error("Send error:", err);
      socket.emit("error", { message: "Failed to send" });
    }
  });

  // ───── TYPING ─────
  socket.on("typing", ({ matchId }) => {
    socket.to(matchId).emit("user-typing", userId);
  });

  socket.on("stop-typing", ({ matchId }) => {
    socket.to(matchId).emit("user-stop-typing", userId);
  });

  // ───── DISCONNECT ─────
  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    socket.broadcast.emit("user-offline", userId);
    console.log(`User ${userId} disconnected`);
  });
});

app.set("io", io);

// ────────────────────── ROUTES ──────────────────────
app.get("/", (req, res) => {
  res.json({ success: true, message: "LoveConnect API + Real-Time Chat" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/matches", matchRoutes);

// ────────────────────── ERROR HANDLER ──────────────────────
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development" ? err.message : "Server error",
  });
});

// ────────────────────── START SERVER ──────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Socket.IO ready on /socket.io");
});

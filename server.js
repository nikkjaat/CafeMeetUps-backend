import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDatabase from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";

dotenv.config();

const app = express();

// ✅ 1. Define allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://cafemeetups.com",
  "https://www.cafemeetups.com", // cover both
  "https://cafe-meet-ups-frontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean); // remove undefined values

// ✅ 2. Reusable CORS config
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn("❌ Blocked by CORS:", origin);
      return callback(
        new Error(`CORS not allowed for origin: ${origin}`),
        false
      );
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// ✅ 3. Apply globally (this covers preflight too)
app.use(cors(corsOptions));

// ✅ 4. Handle OPTIONS requests for all routes explicitly
app.options("*", cors(corsOptions));

// ✅ 5. JSON + URL Encoded Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 6. Connect DB
connectDatabase();

// ✅ 7. Routes
app.get("/", (req, res) => {
  res.json({ success: true, message: "LoveConnect API is running 🚀" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/matches", matchRoutes);

// ✅ 8. Catch-All Error Handler
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong!",
  });
});

// ✅ 9. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDatabase from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

// ✅ Allow frontend domain explicitly
const allowedOrigins = [
  "https://cafe-meet-ups-frontend.vercel.app",
  "http://localhost:3000", // for local testing
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true, // allows cookies, tokens
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Handle preflight requests globally
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDatabase();

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "LoveConnect API is running",
  });
});

app.use("/api/auth", authRoutes);

// ✅ Global error handler
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌎 Environment: ${process.env.NODE_ENV || "development"}`);
});

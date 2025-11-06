import express from "express";
import {
  register,
  login,
  getProfile,
  updateProfile,
  googleAuth,
  facebookAuth,
  uploadAvatar,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import multer from "multer";
import fs from "fs";
import path from "path";

// Ensure uploads directory exists
const uploadsDir = "uploads/avatars";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory:", uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "avatar-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    console.log("Multer file filter - File received:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    if (file.mimetype.startsWith("image/")) {
      console.log("File accepted");
      cb(null, true);
    } else {
      console.log("File rejected - not an image");
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const router = express.Router();

// Update register route with comprehensive logging
router.post(
  "/register",
  (req, res, next) => {
    upload.single("profilePhoto")(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        console.log("MulterError:", err);
        // A Multer error occurred when uploading
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`,
        });
      } else if (err) {
        console.log("Other error:", err);
        // An unknown error occurred
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      console.log("Multer completed successfully, proceeding to controller");
      // Everything went fine, proceed to register controller
      next();
    });
  },
  register
);

router.post("/login", login);
router.post("/google", googleAuth);
router.post("/facebook", facebookAuth);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, upload.single("profilePhoto"), updateProfile);

export default router;

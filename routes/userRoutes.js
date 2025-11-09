// In your backend routes file
import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getUsers,
  getUserById,
  updateUserPreferences,
  getFilteredUsers,
} from "../controllers/userController.js";

const router = express.Router();

// Get filtered users for swiping - FIXED ROUTE
router.get("/filtered", protect, getFilteredUsers); // Changed from "/discover" to "/filtered"

// Get all users (with basic filters)
router.get("/", protect, getUsers);

// Get user by ID
router.get("/:id", protect, getUserById);

// Update user preferences
router.put("/preferences", protect, updateUserPreferences);

export default router;

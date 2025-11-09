// routes/matchRoutes.js
import express from "express";
import {
  likeUser,
  superLikeUser,
  getMatches,
} from "../controllers/matchController.js";
import { sendMessage, getMessages } from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Like routes
router.post("/like/:toUserId", protect, likeUser);
router.post("/super-like/:toUserId", protect, superLikeUser);
router.get("/", protect, getMatches);

// Message routes
router.post("/message", protect, sendMessage);
router.get("/messages/:matchId", protect, getMessages);

export default router;

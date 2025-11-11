// controllers/matchController.js
import User from "../models/User.js";
import Match from "../models/Match.js";
import Message from "../models/Message.js";

// POST /api/like/:toUserId
export const likeUser = async (req, res) => {
  try {
    const fromUserId = req.user.id; // From auth middleware
    const toUserId = req.params.toUserId;

    console.log(fromUserId, toUserId);

    // Validate users
    if (fromUserId === toUserId) {
      return res.status(400).json({
        success: false,
        message: "Cannot like yourself",
      });
    }

    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId),
      User.findById(toUserId),
    ]);

    if (!fromUser || !toUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already liked
    if (fromUser.likes.includes(toUserId)) {
      return res.status(400).json({
        success: false,
        message: "Already liked this user",
      });
    }

    // Add to likes array
    fromUser.likes.push(toUserId);
    await fromUser.save();

    // Check for mutual like (match)
    let isMatch = false;
    let match = null;

    if (toUser.likes.includes(fromUserId)) {
      isMatch = true;

      // Create match
      match = new Match({
        users: [fromUserId, toUserId],
      });

      await match.save();

      // Add to both users' matches array
      await Promise.all([
        User.findByIdAndUpdate(fromUserId, {
          $addToSet: { matches: toUserId },
        }),
        User.findByIdAndUpdate(toUserId, {
          $addToSet: { matches: fromUserId },
        }),
      ]);

      // Create welcome message
      const welcomeMessage = new Message({
        matchId: match._id,
        senderId: "system", // Or use a system user
        receiverId: fromUserId,
        messageText: `You matched with ${toUser.name}! Start the conversation.`,
      });

      await welcomeMessage.save();

      // Update match last message
      match.lastMessage = {
        text: welcomeMessage.messageText,
        sender: welcomeMessage.senderId,
        timestamp: welcomeMessage.createdAt,
      };
      await match.save();
    }

    res.json({
      success: true,
      isMatch,
      match: isMatch ? match : null,
      message: isMatch ? "It's a match!" : "Like saved",
    });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// POST /api/super-like/:toUserId (Premium feature)
export const superLikeUser = async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const toUserId = req.params.toUserId;

    // Check if user is premium
    const fromUser = await User.findById(fromUserId);
    if (!fromUser.isPremium) {
      return res.status(403).json({
        success: false,
        message: "Premium feature required",
      });
    }

    // Same logic as likeUser but with super like notification
    // Implement similar to likeUser with additional notification logic

    res.json({
      success: true,
      message: "Super like sent!",
    });
  } catch (error) {
    console.error("Super like error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// controllers/matchController.js - Fix getMatches function
export const getMatches = async (req, res) => {
  try {
    const userId = req.user.id;

    const matches = await Match.find({
      users: userId,
      isActive: true,
    })
      .populate("users", "name age avatar location interests")
      .sort({ updatedAt: -1 });

    console.log(`📊 Found ${matches.length} matches for user ${userId}`);

    // Format response with match details
    const formattedMatches = matches.map((match) => {
      const otherUser = match.users.find(
        (user) => user._id.toString() !== userId
      );

      console.log(
        `🎯 Formatting match ${match._id} with user:`,
        otherUser?.name
      );

      return {
        _id: match._id, // This is the crucial fix - add _id field
        matchId: match._id, // For backward compatibility
        user: otherUser,
        lastMessage: match.lastMessage,
        matchedAt: match.createdAt,
        messages: [], // Initialize empty messages array
      };
    });

    console.log("✅ Formatted matches:", formattedMatches);

    res.json({
      success: true,
      matches: formattedMatches,
    });
  } catch (error) {
    console.error("Get matches error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

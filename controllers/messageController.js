// controllers/messageController.js
import Message from "../models/Message.js";
import Match from "../models/Match.js";

// POST /api/matches/messages - Send message
export const sendMessage = async (req, res) => {
  try {
    const { matchId, message } = req.body; // Changed from messageText to message
    const senderId = req.user.id;

    console.log("📨 Send message request:", { matchId, message, senderId });

    // Validate match exists and user is part of it
    const match = await Match.findOne({
      _id: matchId,
      users: senderId, // Simplified check - user just needs to be in match
      isActive: true,
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Match not found or inactive",
      });
    }

    // Get receiver ID (the other user in the match)
    const receiverId = match.users.find(
      (user) => user.toString() !== senderId.toString()
    );

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "Invalid match configuration",
      });
    }

    // Create message
    const newMessage = new Message({
      matchId,
      senderId,
      receiverId,
      messageText: message, // Use the message field
    });

    await newMessage.save();

    // Update match's last message
    match.lastMessage = {
      text: message,
      sender: senderId,
      timestamp: new Date(),
    };
    await match.save();

    // Populate sender info for response
    await newMessage.populate("senderId", "name avatar");

    res.json({
      success: true,
      message: {
        id: newMessage._id,
        text: newMessage.messageText,
        sender: newMessage.senderId._id.toString(), // Just send ID for frontend to handle
        senderInfo: {
          name: newMessage.senderId.name,
          avatar: newMessage.senderId.avatar,
        },
        timestamp: newMessage.createdAt,
        isRead: newMessage.isRead,
      },
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET /api/matches/messages/:matchId - Get conversation
export const getMessages = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    console.log("📨 Get messages request:", { matchId, userId });

    // Verify user is part of this match
    const match = await Match.findOne({
      _id: matchId,
      users: userId,
    });

    if (!match) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these messages",
      });
    }

    const messages = await Message.find({ matchId })
      .populate("senderId", "name avatar")
      .sort({ createdAt: 1 });

    console.log(`📨 Found ${messages.length} messages for match ${matchId}`);

    // Mark messages as read for current user
    await Message.updateMany(
      {
        matchId,
        receiverId: userId,
        isRead: false,
      },
      { isRead: true }
    );

    // Format response for frontend
    const formattedMessages = messages.map((msg) => ({
      id: msg._id,
      text: msg.messageText,
      sender: msg.senderId._id.toString() === userId ? "user" : "match", // Convert to "user" or "match"
      senderId: msg.senderId._id,
      senderInfo: {
        name: msg.senderId.name,
        avatar: msg.senderId.avatar,
      },
      timestamp: msg.createdAt,
      isRead: msg.isRead,
    }));

    res.json({
      success: true,
      messages: formattedMessages,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

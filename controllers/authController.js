import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import User from "../models/User.js";
import admin from "../config/firebase.js";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// Add this after your imports
const allInterests = [
  "coffee",
  "clubbing",
  "travel",
  "movies",
  "gaming",
  "serious-relationship",
  "fitness",
  "music",
  "food",
];

export const register = async (req, res) => {
  console.log("Register controller - req.file:", req.file);
  console.log("Register controller - req.body keys:", Object.keys(req.body));

  try {
    // Handle multipart form data
    const {
      fullName: name,
      email,
      password,
      birthDate,
      age,
      location,
      gender,
      interestedIn,
      relationshipType,
      bio,
      phoneNumber,
      agreeToTerms,
      selectedInterests,
    } = req.body;

    // Log all received data for debugging
    console.log("Received registration data:");
    Object.keys(req.body).forEach((key) => {
      if (key !== "password") {
        console.log(`${key}:`, req.body[key]);
      } else {
        console.log(`${key}:`, "***");
      }
    });

    // FIX: Parse selectedInterests properly
    let selectedInterestsArray = [];

    if (req.body.selectedInterests) {
      try {
        // If it's a string, split by commas and clean up
        if (typeof req.body.selectedInterests === "string") {
          selectedInterestsArray = req.body.selectedInterests
            .split(",")
            .map((interest) => interest.trim())
            .filter(
              (interest) => interest !== "" && allInterests.includes(interest)
            );
        }
        // If it's already an array, use it directly
        else if (Array.isArray(req.body.selectedInterests)) {
          selectedInterestsArray = req.body.selectedInterests.filter(
            (interest) => interest !== "" && allInterests.includes(interest)
          );
        }

        // Validate max 4 interests
        if (selectedInterestsArray.length > 4) {
          return res.status(400).json({
            success: false,
            message: "Cannot select more than 4 interests",
          });
        }

        console.log("Parsed selectedInterests:", selectedInterestsArray);
      } catch (error) {
        console.log("Error parsing selectedInterests:", error);
        console.log("Raw selectedInterests data:", req.body.selectedInterests);
      }
    }

    // For backward compatibility, also check the old interests field
    let interests = [];
    if (req.body.interests && selectedInterestsArray.length === 0) {
      try {
        if (typeof req.body.interests === "string") {
          interests = req.body.interests
            .split(",")
            .filter((interest) => interest.trim() !== "");
        } else if (Array.isArray(req.body.interests)) {
          interests = req.body.interests;
        }
        console.log("Parsed interests (legacy):", interests);
      } catch (error) {
        console.log("Error parsing interests:", error);
      }
    }

    // Use selectedInterests if available, otherwise fall back to interests
    const finalInterests =
      selectedInterestsArray.length > 0 ? selectedInterestsArray : interests;

    console.log("Final interests to save:", finalInterests);

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password",
      });
    }

    if (!agreeToTerms || agreeToTerms === "false") {
      return res.status(400).json({
        success: false,
        message: "You must agree to the terms and conditions",
      });
    }

    // Validate interests
    if (finalInterests.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one interest",
      });
    }

    // Validate max interests (double check)
    if (finalInterests.length > 4) {
      return res.status(400).json({
        success: false,
        message: "Cannot select more than 4 interests",
      });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Handle profile photo upload
    let avatar =
      "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150";

    if (req.file) {
      avatar = `/uploads/avatars/${req.file.filename}`;
    }

    // FIX: Create user object with properly formatted interests
    const userData = {
      name,
      email,
      password,
      age: parseInt(age) || calculateAge(birthDate),
      location,
      gender,
      interestedIn,
      relationshipType,
      bio,
      phoneNumber,
      interests: finalInterests, // Keep for backward compatibility
      selectedInterests: finalInterests, // Use the same array for both
      avatar,
      lookingFor: relationshipType || "",
    };

    console.log("Creating user with data:", {
      ...userData,
      password: "***",
      selectedInterests: finalInterests,
    });

    // In your register controller, before creating the user:
    if (finalInterests.length > 4) {
      return res.status(400).json({
        success: false,
        message: "Cannot select more than 4 interests",
      });
    }

    const user = await User.create(userData);

    if (user) {
      const token = generateToken(user._id);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          age: user.age,
          location: user.location,
          avatar: user.avatar,
          bio: user.bio,
          interests: user.interests,
          selectedInterests: user.selectedInterests,
          gender: user.gender,
          interestedIn: user.interestedIn,
          relationshipType: user.relationshipType,
          phoneNumber: user.phoneNumber,
          lookingFor: user.lookingFor,
          isEmailVerified: user.isEmailVerified,
          googleId: user.googleId,
          facebookId: user.facebookId,
          createdAt: user.createdAt,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid user data",
      });
    }
  } catch (error) {
    console.error("Register controller error:", error);

    // Handle Mongoose validation errors specifically
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error during registration",
    });
  }
};

// Helper function to calculate age from birth date
const calculateAge = (birthDate) => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        age: user.age,
        location: user.location,
        avatar: user.avatar,
        interests: user.interests || [],
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error during login",
    });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { tokenId } = req.body;

    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(tokenId);
    const { uid: googleId, email, name, picture } = decodedToken;

    let user = await User.findOne({
      $or: [{ email: email }, { googleId: googleId }],
    });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture,
        password: "google-auth-" + Date.now(),
        isEmailVerified: true,
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Google authentication successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        age: user.age,
        location: user.location,
        avatar: user.avatar,
        bio: user.bio,
        interests: user.interests || [],
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Google authentication failed",
    });
  }
};

export const facebookAuth = async (req, res) => {
  try {
    const { tokenId } = req.body;

    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: "Facebook token is required",
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(tokenId);
    const { uid: facebookId, email, name, picture } = decodedToken;

    let user = await User.findOne({
      $or: [{ email: email }, { facebookId: facebookId }],
    });

    if (user) {
      if (!user.facebookId) {
        user.facebookId = facebookId;
        await user.save();
      }
    } else {
      user = await User.create({
        name,
        email: email || `facebook_${facebookId}@example.com`,
        facebookId,
        avatar: picture,
        password: "facebook-auth-" + Date.now(),
        isEmailVerified: true,
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Facebook authentication successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        age: user.age,
        location: user.location,
        avatar: user.avatar,
        bio: user.bio,
        interests: user.interests || [],
      },
    });
  } catch (error) {
    console.error("Facebook auth error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Facebook authentication failed",
    });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old avatar if it exists and is not default
    if (user.avatar && !user.avatar.includes("pexels.com")) {
      const oldAvatarPath = path.join(
        process.cwd(),
        "uploads",
        "avatars",
        path.basename(user.avatar)
      );
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update user avatar
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      avatarUrl,
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Avatar upload failed",
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        age: user.age,
        location: user.location,
        avatar: user.avatar,
        bio: user.bio,
        interests: user.interests,
        gender: user.gender, // Added
        interestedIn: user.interestedIn, // Added
        relationshipType: user.relationshipType, // Added
        phoneNumber: user.phoneNumber, // Added
        lookingFor: user.lookingFor,
        isEmailVerified: user.isEmailVerified, // Added
        googleId: user.googleId, // Added
        facebookId: user.facebookId, // Added
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    // Parse selectedInterests if it's a string
    if (
      req.body.selectedInterests &&
      typeof req.body.selectedInterests === "string"
    ) {
      req.body.selectedInterests = req.body.selectedInterests
        .split(",")
        .filter((interest) => interest.trim() !== "");
    }

    // Validate interests count
    if (req.body.selectedInterests && req.body.selectedInterests.length > 4) {
      return res.status(400).json({
        success: false,
        message: "Cannot select more than 4 interests",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        age: user.age,
        location: user.location,
        avatar: user.avatar,
        bio: user.bio,
        interests: user.interests,
        selectedInterests: user.selectedInterests,
        gender: user.gender,
        interestedIn: user.interestedIn,
        relationshipType: user.relationshipType,
        phoneNumber: user.phoneNumber,
        lookingFor: user.lookingFor,
        isEmailVerified: user.isEmailVerified,
        googleId: user.googleId,
        facebookId: user.facebookId,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

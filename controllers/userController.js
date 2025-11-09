import User from "../models/User.js";

export const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      ageMin,
      ageMax,
      location,
      interests,
      gender,
      interestedIn,
      relationshipType,
      lookingFor,
    } = req.query;

    const currentUser = await User.findById(req.user.id);

    // Build filter query
    const filter = {
      _id: { $ne: req.user.id }, // Exclude current user
    };

    // Age filter
    if (ageMin || ageMax) {
      filter.age = {};
      if (ageMin) filter.age.$gte = parseInt(ageMin);
      if (ageMax) filter.age.$lte = parseInt(ageMax);
    }

    // Location filter (basic text match)
    if (location) {
      filter.location = { $regex: location, $options: "i" };
    }

    // Gender filter
    if (gender) {
      filter.gender = gender;
    }

    // Interested in filter
    if (interestedIn) {
      filter.interestedIn = interestedIn;
    }

    // Relationship type filter
    if (relationshipType) {
      filter.relationshipType = relationshipType;
    }

    // Looking for filter
    if (lookingFor) {
      filter.lookingFor = lookingFor;
    }

    // Interests filter - check both interests arrays
    if (interests) {
      const interestArray = interests.split(",");
      filter.$or = [
        { selectedInterests: { $in: interestArray } },
        { interests: { $in: interestArray } },
      ];
    }

    // Apply user's gender preferences based on interestedIn
    if (currentUser.interestedIn && currentUser.interestedIn !== "everyone") {
      if (currentUser.interestedIn === "men") {
        filter.gender = "male";
      } else if (currentUser.interestedIn === "women") {
        filter.gender = "female";
      }
    }

    const users = await User.find(filter)
      .select("-password -__v")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// In your userController.js
export const getFilteredUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const {
      category = "all",
      ageMin = 18,
      ageMax = 100,
      distance = 50,
      interests = "",
      relationshipType = "",
      lookingFor = "",
      limit = 50,
    } = req.query;

    // Get current user to check matches and preferences
    const currentUser = await User.findById(currentUserId)
      .populate("matches", "_id")
      .populate("likes", "_id");

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get IDs of users already matched with or liked
    const excludedUserIds = [
      currentUserId,
      ...currentUser.matches.map((match) => match._id),
      ...currentUser.likes.map((like) => like._id),
    ];

    // Build filter query
    let filterQuery = {
      _id: { $nin: excludedUserIds }, // Exclude matched/liked users and self
      age: { $gte: parseInt(ageMin), $lte: parseInt(ageMax) },
    };

    // Gender preference filter
    if (currentUser.interestedIn !== "everyone") {
      const targetGender =
        currentUser.interestedIn === "men" ? "male" : "female";
      filterQuery.gender = targetGender;
    }

    // Relationship type filter
    if (relationshipType) {
      filterQuery.relationshipType = relationshipType;
    }

    // Interests filter
    if (interests) {
      const interestsArray = interests
        .split(",")
        .map((interest) => interest.trim());
      filterQuery.selectedInterests = { $in: interestsArray };
    }

    // Get filtered users
    const users = await User.find(filterQuery)
      .select("-password -email -phoneNumber") // Exclude sensitive info
      .limit(parseInt(limit));

    // Calculate compatibility scores and common interests
    const usersWithCompatibility = users.map((user) => {
      const commonInterests = user.selectedInterests.filter((interest) =>
        currentUser.selectedInterests.includes(interest)
      );

      const compatibilityScore = calculateCompatibility(
        currentUser,
        user,
        commonInterests
      );

      return {
        ...user.toObject(),
        commonInterests,
        compatibilityScore,
        distance: Math.floor(Math.random() * 50) + 1, // Mock distance for now
      };
    });

    // Sort by compatibility score (highest first)
    usersWithCompatibility.sort(
      (a, b) => b.compatibilityScore - a.compatibilityScore
    );

    res.json({
      success: true,
      users: usersWithCompatibility,
      currentUserInfo: {
        id: currentUser._id,
        name: currentUser.name,
        age: currentUser.age,
        gender: currentUser.gender,
        interestedIn: currentUser.interestedIn,
        selectedInterests: currentUser.selectedInterests,
      },
    });
  } catch (error) {
    console.error("Get filtered users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
    });
  }
};

// Helper function to calculate compatibility
const calculateCompatibility = (currentUser, otherUser, commonInterests) => {
  let score = 50; // Base score

  // Age compatibility
  const ageDiff = Math.abs(currentUser.age - otherUser.age);
  if (ageDiff <= 5) score += 20;
  else if (ageDiff <= 10) score += 10;

  // Interest compatibility
  if (commonInterests.length > 0) {
    score +=
      (commonInterests.length /
        Math.max(
          currentUser.selectedInterests.length,
          otherUser.selectedInterests.length
        )) *
      30;
  }

  // Relationship type compatibility
  if (
    currentUser.relationshipType &&
    otherUser.relationshipType &&
    currentUser.relationshipType === otherUser.relationshipType
  ) {
    score += 10;
  }

  return Math.min(Math.round(score), 100);
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

export const updateUserPreferences = async (req, res) => {
  try {
    const {
      ageMin,
      ageMax,
      distance,
      interests,
      relationshipType,
      // Add new fields from model
      lookingFor,
      selectedInterests,
      bio,
      location,
      age,
      gender,
      interestedIn,
    } = req.body;

    const updateData = {};

    // Update preferences object
    if (
      ageMin !== undefined ||
      ageMax !== undefined ||
      distance !== undefined ||
      interests !== undefined ||
      relationshipType !== undefined
    ) {
      updateData.preferences = {
        ageMin: ageMin || 18,
        ageMax: ageMax || 100,
        distance: distance || 50,
        interests: interests || [],
        relationshipType: relationshipType || "",
      };
    }

    // Update direct user fields
    if (lookingFor !== undefined) updateData.lookingFor = lookingFor;
    if (selectedInterests !== undefined)
      updateData.selectedInterests = selectedInterests;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (age !== undefined) updateData.age = age;
    if (gender !== undefined) updateData.gender = gender;
    if (interestedIn !== undefined) updateData.interestedIn = interestedIn;

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -__v");

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// New function to update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const {
      name,
      age,
      location,
      bio,
      gender,
      interestedIn,
      relationshipType,
      lookingFor,
      selectedInterests,
      interests,
      avatar,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        age,
        location,
        bio,
        gender,
        interestedIn,
        relationshipType,
        lookingFor,
        selectedInterests,
        interests,
        avatar,
      },
      { new: true, runValidators: true }
    ).select("-password -__v");

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// New function to get current user's complete profile
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

import User from "../models/User.js";

class MatchingService {
  // Basic filtering based on preferences
  static applyBasicFilters(currentUser, otherUser) {
    // 1. Age preference check
    const ageInRange =
      otherUser.age >= currentUser.preferences.ageMin &&
      otherUser.age <= currentUser.preferences.ageMax;

    // 2. Gender preference check
    let genderMatch = false;
    switch (currentUser.interestedIn) {
      case "men":
        genderMatch = otherUser.gender === "male";
        break;
      case "women":
        genderMatch = otherUser.gender === "female";
        break;
      case "everyone":
        genderMatch = true;
        break;
      default:
        genderMatch = true;
    }

    // 3. Check if other user is also interested in current user's gender
    let mutualGenderInterest = false;
    switch (otherUser.interestedIn) {
      case "men":
        mutualGenderInterest = currentUser.gender === "male";
        break;
      case "women":
        mutualGenderInterest = currentUser.gender === "female";
        break;
      case "everyone":
        mutualGenderInterest = true;
        break;
      default:
        mutualGenderInterest = true;
    }

    // 4. Distance check (if coordinates available)
    let distanceValid = true;
    if (currentUser.location?.coordinates && otherUser.location?.coordinates) {
      const distance = currentUser.calculateDistance(otherUser);
      if (distance !== null && distance > currentUser.preferences.distance) {
        distanceValid = false;
      }
    }

    return ageInRange && genderMatch && mutualGenderInterest && distanceValid;
  }

  // Calculate compatibility score
  static calculateCompatibilityScore(currentUser, otherUser, commonInterests) {
    let score = 0;

    // 1. Interest similarity (40% weight)
    const interestScore =
      (commonInterests.length /
        Math.max(
          currentUser.selectedInterests?.length || 1,
          otherUser.selectedInterests?.length || 1
        )) *
      40;
    score += interestScore;

    // 2. Age proximity (15% weight)
    const ageDiff = Math.abs(currentUser.age - otherUser.age);
    const ageScore = Math.max(0, 15 - ageDiff * 0.5);
    score += ageScore;

    // 3. Activity level (15% weight)
    const activityScore = (otherUser.activityScore / 1000) * 15;
    score += activityScore;

    // 4. Distance proximity (15% weight)
    let distanceScore = 15;
    if (currentUser.location?.coordinates && otherUser.location?.coordinates) {
      const distance = currentUser.calculateDistance(otherUser);
      if (distance !== null) {
        distanceScore = Math.max(
          0,
          15 - (distance / currentUser.preferences.distance) * 5
        );
      }
    }
    score += distanceScore;

    // 5. Profile completeness (10% weight)
    const profileScore = (otherUser.profileCompleteness / 100) * 10;
    score += profileScore;

    // 6. Relationship type match (5% weight)
    if (
      currentUser.relationshipType &&
      otherUser.relationshipType &&
      currentUser.relationshipType === otherUser.relationshipType
    ) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  // Get common interests between users
  static getCommonInterests(user1, user2) {
    const interests1 = user1.selectedInterests || [];
    const interests2 = user2.selectedInterests || [];
    return interests1.filter((interest) => interests2.includes(interest));
  }

  // Main method to get filtered and scored profiles
  static async getCompatibleProfiles(currentUserId, options = {}) {
    const { page = 1, limit = 20, category = null, minScore = 0 } = options;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    // Get all potential matches (excluding current user)
    const allUsers = await User.find({
      _id: { $ne: currentUserId },
      isEmailVerified: true,
    }).select("-password -__v");

    // Apply basic filters and calculate scores
    const scoredProfiles = [];

    for (const user of allUsers) {
      // Apply basic filters
      if (!this.applyBasicFilters(currentUser, user)) {
        continue;
      }

      // Apply category filter if specified
      if (category && category !== "all") {
        if (!user.selectedInterests?.includes(category)) {
          continue;
        }
      }

      // Calculate compatibility
      const commonInterests = this.getCommonInterests(currentUser, user);
      const compatibilityScore = this.calculateCompatibilityScore(
        currentUser,
        user,
        commonInterests
      );

      // Skip if below minimum score
      if (compatibilityScore < minScore) {
        continue;
      }

      scoredProfiles.push({
        user: user.toObject(),
        score: compatibilityScore,
        commonInterests,
        distance: currentUser.calculateDistance(user),
      });
    }

    // Sort by score (descending) and then by activity score
    scoredProfiles.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.user.activityScore - a.user.activityScore;
    });

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProfiles = scoredProfiles.slice(startIndex, endIndex);

    // Transform for frontend
    const transformedUsers = paginatedProfiles.map(
      ({ user, score, commonInterests, distance }) => ({
        id: user._id,
        name: user.name,
        age: user.age,
        location: user.location?.address || "Location not specified",
        images: [user.avatar],
        bio: user.bio || "No bio available",
        interests: user.selectedInterests || [],
        commonInterests,
        compatibilityScore: Math.round(score),
        distance: distance ? Math.round(distance) : null,
        activityScore: user.activityScore,
        lastActive: user.lastActive,
        gender: user.gender,
        relationshipType: user.relationshipType,
        lookingFor: user.lookingFor,
        interestedIn: user.interestedIn,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      })
    );

    return {
      users: transformedUsers,
      total: scoredProfiles.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(scoredProfiles.length / limit),
    };
  }
}

export default MatchingService;

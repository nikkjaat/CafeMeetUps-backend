import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: function () {
        return !this.googleId && !this.facebookId;
      },
      unique: true,
      sparse: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId && !this.facebookId;
      },
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    facebookId: {
      type: String,
      unique: true,
      sparse: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    age: {
      type: Number,
      min: [18, "Must be at least 18 years old"],
      max: [100, "Invalid age"],
    },
    location: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default:
        "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150",
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot be more than 500 characters"],
    },
    interests: [
      {
        type: String,
      },
    ],
    // New field for predefined interests with max 4
    selectedInterests: [
      {
        type: String,
        enum: [
          "coffee",
          "clubbing",
          "travel",
          "movies",
          "gaming",
          "serious-relationship",
          "fitness",
          "music",
          "food",
        ],
      },
    ],
    gender: {
      type: String,
      enum: ["male", "female", "non-binary", "other"],
    },
    interestedIn: {
      type: String,
      enum: ["men", "women", "everyone"],
    },
    relationshipType: {
      type: String,
      enum: [
        "casual",
        "serious",
        "long-term",
        "friendship",
        "marriage",
        "not-sure",
        "",
      ],
      default: "",
    },
    phoneNumber: {
      type: String,
    },
    preferences: {
      ageMin: {
        type: Number,
        default: 18,
        min: 18,
        max: 100,
      },
      ageMax: {
        type: Number,
        default: 100,
        min: 18,
        max: 100,
      },
      distance: {
        type: Number,
        default: 50,
        min: 1,
        max: 100,
      },
      interests: [
        {
          type: String,
        },
      ],
      relationshipType: {
        type: String,
        default: "",
      },
    },
    lookingFor: {
      type: String,
      enum: [
        "serious",
        "casual",
        "friends",
        "networking",
        "marriage",
        "friendship",
        "long-term",
        "",
      ],
      default: "",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likeCount: {
      type: Number,
      default: 0,
    },

    matches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isPremium: {
      type: Boolean,
      default: false,
    },

    superLikes: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;

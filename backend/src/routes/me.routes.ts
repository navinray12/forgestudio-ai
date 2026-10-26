import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { prisma } from "../config/prisma.js";

const router = Router();

// Store account preferences with backward-compatible defaults
const userPreferencesStore = new Map<string, any>();

router.get("/me", requireAuth, async (req, res) => {
  const sessionUser = res.locals.user;
  const user = (await prisma.user.findUnique({
    where: { id: sessionUser.id },
  })) || sessionUser;

  const defaultPreferences = {
    city: "New York",
    timezone: "UTC/GMT -4 hours",
    dateTimeFormat: "dd/mm/yyyy 00:00",
    dailyUtilization: 7,
    coreWorkRange: [3, 6],
    function: "Design",
    jobTitle: "Team Lead designer",
    notificationSettings: {
      desktopNotifications: true,
      unreadBadge: true,
      pushTimeout: "10 Minutes",
      communicationEmails: true,
      announcements: false,
      disableSounds: false,
    },
  };

  const preferences = userPreferencesStore.get(user.id) || defaultPreferences;

  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        lastLoginAt: user.lastLoginAt,
        preferences,
      },
    },
  });
});

router.patch("/me", requireAuth, async (req, res) => {
  try {
    const user = res.locals.user;
    const { fullName, email, city, timezone, dateTimeFormat, dailyUtilization, coreWorkRange, function: func, jobTitle, notificationSettings } = req.body;

    const updateData: { fullName?: string; email?: string } = {};
    if (fullName !== undefined) {
      if (typeof fullName !== "string") {
        return res.status(400).json({ success: false, message: "Full name must be a string." });
      }
      updateData.fullName = fullName.trim();
    }
    if (email !== undefined) {
      if (typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ success: false, message: "A valid email address is required." });
      }
      const cleanEmail = email.trim().toLowerCase();
      const existing = await prisma.user.findFirst({
        where: { email: cleanEmail, NOT: { id: user.id } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: "Email is already in use by another account." });
      }
      updateData.email = cleanEmail;
    }

    let updatedUser = user;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    const currentPrefs = userPreferencesStore.get(user.id) || {
      city: "New York",
      timezone: "UTC/GMT -4 hours",
      dateTimeFormat: "dd/mm/yyyy 00:00",
      dailyUtilization: 7,
      coreWorkRange: [3, 6],
      function: "Design",
      jobTitle: "Team Lead designer",
      notificationSettings: {
        desktopNotifications: true,
        unreadBadge: true,
        pushTimeout: "10 Minutes",
        communicationEmails: true,
        announcements: false,
        disableSounds: false,
      },
    };

    const newPrefs = {
      ...currentPrefs,
      ...(city !== undefined ? { city } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
      ...(dateTimeFormat !== undefined ? { dateTimeFormat } : {}),
      ...(dailyUtilization !== undefined ? { dailyUtilization } : {}),
      ...(coreWorkRange !== undefined ? { coreWorkRange } : {}),
      ...(func !== undefined ? { function: func } : {}),
      ...(jobTitle !== undefined ? { jobTitle } : {}),
      ...(notificationSettings !== undefined ? { notificationSettings: { ...currentPrefs.notificationSettings, ...notificationSettings } } : {}),
    };
    userPreferencesStore.set(user.id, newPrefs);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          status: updatedUser.status,
          emailVerified: updatedUser.emailVerified,
          phoneVerified: updatedUser.phoneVerified,
          lastLoginAt: updatedUser.lastLoginAt,
          preferences: newPrefs,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to update profile",
    });
  }
});

router.put("/me", requireAuth, async (req, res, next) => {
  return (router as any).handle({ ...req, method: "PATCH" }, res, next);
});

export default router;
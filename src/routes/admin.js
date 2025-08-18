const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  requireAdmin,
  requireSuperAdmin,
  logAdminAction,
} = require("../middleware/adminMiddleware");
const { validateAdminRegistration } = require("../middleware/validation");

/**
 * Admin Routes
 * Base path: /api/admin
 */

// Admin routes (require authentication and admin role)
router.get(
  "/dashboard",
  authenticateToken,
  requireAdmin,
  adminController.getDashboardStats
);
router.get(
  "/feedback",
  authenticateToken,
  requireAdmin,
  adminController.getAllFeedback
);
// Feedback management routes (Admin only)
router.get(
  "/feedback/:id",
  authenticateToken,
  requireAdmin,
  adminController.getFeedbackById
);

router.put(
  "/feedback/:id",
  authenticateToken,
  requireAdmin,
  logAdminAction("update_feedback", "feedback"),
  adminController.updateFeedback
);

router.delete(
  "/feedback/:id",
  authenticateToken,
  requireAdmin,
  logAdminAction("delete_feedback", "feedback"),
  adminController.deleteFeedback
);

router.post(
  "/cache/clear",
  authenticateToken,
  requireAdmin,
  logAdminAction("clear_cache", "system"),
  adminController.clearSearchCache
);

router.get(
  "/cache/stats",
  authenticateToken,
  requireAdmin,
  adminController.getSearchCacheStats
);

router.get(
  "/health/database",
  authenticateToken,
  requireAdmin,
  adminController.testDatabaseHealth
);

// Super Admin routes (require super admin role)
router.post(
  "/admins",
  authenticateToken,
  requireSuperAdmin,
  validateAdminRegistration,
  logAdminAction("create_admin", "admin"),
  adminController.createAdmin
);

router.get(
  "/system/info",
  authenticateToken,
  requireSuperAdmin,
  adminController.getSystemInfo
);

module.exports = router;

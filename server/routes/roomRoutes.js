const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const roomController = require("../controllers/roomController");
const { validateUserPayload } = require("../middleware/authMiddleware");

/**
 * Room Routes
 * Follows the routing structure from the reference project.
 * Uses router.route() to group methods on identical URI paths.
 */

// Route: /api/rooms
router
  .route("/")
  .post(validateUserPayload, wrapAsync((req, res) => roomController.createRoom(req, res)));

// Route: /api/rooms/:roomCode
router
  .route("/:roomCode")
  .get(wrapAsync((req, res) => roomController.getRoom(req, res)))
  .delete(validateUserPayload, wrapAsync((req, res) => roomController.deleteRoom(req, res)));

module.exports = router;

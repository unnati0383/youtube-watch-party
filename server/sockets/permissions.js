/**
 * Role-Based Access Control (RBAC) Permissions Module
 * 
 * CRITICAL SECURITY PRINCIPLE:
 * Frontend UI disablement is merely cosmetic for user experience.
 * True authorization MUST be strictly verified on the backend for every incoming socket action.
 * Never trust role claims sent directly in client payloads!
 */

const ROLES = {
  HOST: "Host",
  MODERATOR: "Moderator",
  PARTICIPANT: "Participant",
};

/**
 * Checks if a given role is allowed to control playback
 * (play, pause, seek, change video)
 * Allowed: Host, Moderator
 * Denied: Participant
 */
function canControlPlayback(role) {
  return role === ROLES.HOST || role === ROLES.MODERATOR;
}

/**
 * Checks if a given role is allowed to assign or demote roles (e.g., promote to Moderator)
 * Allowed: Host only
 * Denied: Moderator, Participant
 */
function canAssignRole(role) {
  return role === ROLES.HOST;
}

/**
 * Checks if a given role is allowed to kick/remove participants from the room
 * Allowed: Host only
 * Denied: Moderator, Participant
 */
function canRemoveParticipant(role) {
  return role === ROLES.HOST;
}

/**
 * Checks if a given role is allowed to transfer room ownership
 * Allowed: Host only
 * Denied: Moderator, Participant
 */
function canTransferHost(role) {
  return role === ROLES.HOST;
}

module.exports = {
  ROLES,
  canControlPlayback,
  canAssignRole,
  canRemoveParticipant,
  canTransferHost,
};

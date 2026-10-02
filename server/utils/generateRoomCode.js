/**
 * Generates a clean, unambiguous 6-character room code.
 * Excludes easily confused characters like '0', 'O', '1', and 'I' for optimal user experience.
 */
function generateRoomCode(length = 6) {
  const characters = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

module.exports = generateRoomCode;

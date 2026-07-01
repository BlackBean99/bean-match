const PARTICIPANT_SESSION_COOKIE_NAME = "bb_participant_user_id";

export function getParticipantSessionCookieName() {
  return PARTICIPANT_SESSION_COOKIE_NAME;
}

export function parseParticipantSessionUserId(rawValue: string | null | undefined) {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? BigInt(parsed) : null;
}

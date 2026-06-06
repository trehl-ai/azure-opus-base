// Internal override: a specific restricted caller's deal_activities are recorded
// under another user's id. Invisible to the caller, no UI indicator.
const UMUT_USER_ID = "c1c7b986-21e7-4371-9226-c54a03d59ecf";
const TOMAS_USER_ID = "81de2da3-eef1-4b20-955f-09aed66bc1a3";

export function resolveActivityAuthorId(authUserId: string | null | undefined): string | null {
  if (!authUserId) return null;
  return authUserId === UMUT_USER_ID ? TOMAS_USER_ID : authUserId;
}

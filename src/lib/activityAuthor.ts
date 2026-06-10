// No overrides — each user's activities are recorded under their own ID.
export const resolveActivityAuthorId = (userId: string | null | undefined): string | null =>
  userId ?? null;

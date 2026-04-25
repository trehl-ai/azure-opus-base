import { useQuery } from "@tanstack/react-query";

/**
 * Email-Signature feature is disabled — table user_email_signatures lacks
 * profile_image_path column. Hooks return null/empty to silence 400 errors.
 */
export function useProfileImage(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["profile-image", userId],
    queryFn: async () => null as string | null,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useProfileImages(userIds: string[]) {
  return useQuery({
    queryKey: ["profile-images", userIds.sort().join(",")],
    queryFn: async () => ({} as Record<string, string>),
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the public URL of a user's profile image from signature-images bucket.
 * Pass the user's public ID (from users table).
 */
export function useProfileImage(userId: string | undefined | null) {
  return useQuery({
    queryKey: ["profile-image", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: sig } = await supabase
        .from("user_email_signatures")
        .select("profile_image_path")
        .eq("user_id", userId)
        .maybeSingle();

      if (!sig?.profile_image_path) return null;

      const { data: urlData } = supabase.storage
        .from("signature-images")
        .getPublicUrl(sig.profile_image_path);

      return urlData?.publicUrl || null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Bulk fetch profile images for multiple user IDs.
 */
export function useProfileImages(userIds: string[]) {
  return useQuery({
    queryKey: ["profile-images", userIds.sort().join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data: sigs } = await supabase
        .from("user_email_signatures")
        .select("user_id, profile_image_path")
        .in("user_id", userIds);

      if (!sigs) return {};

      const result: Record<string, string> = {};
      for (const sig of sigs) {
        if (sig.profile_image_path) {
          const { data: urlData } = supabase.storage
            .from("signature-images")
            .getPublicUrl(sig.profile_image_path);
          if (urlData?.publicUrl) {
            result[sig.user_id] = urlData.publicUrl;
          }
        }
      }
      return result;
    },
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

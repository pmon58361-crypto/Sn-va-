// Shared app types & constants.

export type PostCategory =
  | "COMMUNITY"
  | "JOB_OFFER"
  | "JOB_REQUEST"
  | "JOB_LISTING";

export const POST_CATEGORIES: PostCategory[] = [
  "COMMUNITY",
  "JOB_OFFER",
  "JOB_REQUEST",
  "JOB_LISTING",
];

// Hard limit on images per post, enforced server-side.
export const MAX_IMAGES_PER_POST = 100;

// Allowed upload mime types.
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Max size per image file (5 MB).
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const CATEGORY_META: Record<
  PostCategory,
  { label: string; section: "community" | "jobs" | "applications" }
> = {
  COMMUNITY: { label: "Community", section: "community" },
  JOB_OFFER: { label: "Work Offer", section: "jobs" },
  JOB_REQUEST: { label: "Work Request", section: "jobs" },
  JOB_LISTING: { label: "Job Listing", section: "applications" },
};

import { v2 as cloudinary } from "cloudinary";

if (!process.env.CLOUDINARY_URL) {
  console.warn(
    "[cloudinary] CLOUDINARY_URL is not set. Image uploads will fail. " +
      "Add it to .env (see .env.example)."
  );
}

cloudinary.config({ secure: true });

export { cloudinary };

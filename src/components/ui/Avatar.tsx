"use client";

import { useState } from "react";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  image,
  size = 36,
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  // Reset the error flag whenever the URL changes, so a fixed URL shows again.
  const [lastImage, setLastImage] = useState(image);
  if (image !== lastImage) {
    setLastImage(image);
    setBroken(false);
  }

  if (image && !broken) {
    return (
      <img
        src={image}
        alt={name || "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, objectPosition: "center top" }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-surface-hover text-ink-secondary font-semibold border border-line"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

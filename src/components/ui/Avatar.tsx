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
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={name || "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size, objectPosition: "center top" }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-accent-tint text-accent font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

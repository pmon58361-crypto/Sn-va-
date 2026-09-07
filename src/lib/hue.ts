// Deterministic identity hue from any string (names, group titles).
// Used for gradient banners/tiles — derived, never fake data: the same
// name always yields the same hue on every device and render.
export function nameHue(s?: string | null): number {
  const str = (s || "?").toLowerCase();
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360;
  }
  return h;
}

export function hueGradient(
  s?: string | null,
  opts?: { from?: number; to?: number; sat?: number; light?: number }
): string {
  const h = nameHue(s);
  const sat = opts?.sat ?? 65;
  const light = opts?.light ?? 42;
  const from = opts?.from ?? -24;
  const to = opts?.to ?? 24;
  return `linear-gradient(135deg, hsl(${h + from} ${sat}% ${light}%), hsl(${h + to} ${sat}% ${light + 12}%))`;
}

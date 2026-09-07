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
  // Brand-locked: the raw hash spans the whole wheel (which produced a
  // loud purple on some names), so fold it into the red→amber family the
  // app actually wears. Same name still yields the same gradient.
  const base = 350 + (nameHue(s) % 40);
  const sat = opts?.sat ?? 60;
  const light = opts?.light ?? 38;
  const from = opts?.from ?? -14;
  const to = opts?.to ?? 14;
  return `linear-gradient(135deg, hsl(${base + from} ${sat}% ${light}%), hsl(${base + to} ${sat}% ${light + 12}%))`;
}

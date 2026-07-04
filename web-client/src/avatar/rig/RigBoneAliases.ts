import { VORTEX_RIG_RETARGET_ALIASES } from "./VortexRigSpec";

const REVERSE_ALIASES = buildReverseAliases(VORTEX_RIG_RETARGET_ALIASES);

export function runtimeBoneAliases(name: unknown): string[] {
  const raw = String(name || "");
  const canonical = canonicalBoneName(raw);
  const target = VORTEX_RIG_RETARGET_ALIASES[raw] || VORTEX_RIG_RETARGET_ALIASES[canonical] || null;
  return unique([
    raw,
    canonical,
    target,
    ...(REVERSE_ALIASES[raw] || []),
    ...(REVERSE_ALIASES[canonical] || []),
    ...(target ? REVERSE_ALIASES[target] || [] : [])
  ]);
}

export function canonicalBoneName(name: unknown): string {
  return String(name || "").replace(/\s+/g, "_");
}

function buildReverseAliases(aliases: Readonly<Record<string, string>>): Record<string, string[]> {
  const reverse: Record<string, string[]> = {};
  for (const [source, target] of Object.entries(aliases)) {
    reverse[target] = reverse[target] || [];
    reverse[target].push(source, canonicalBoneName(source));
  }
  return reverse;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

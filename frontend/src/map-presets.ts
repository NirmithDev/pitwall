import { normalizeLayout, type MapLayout } from "./map-layout";
export interface MapPreset {
  id: string;
  name: string;
  layout: MapLayout;
}
export const presetsKey = (raceId: string) =>
  `pitwall.presets.v1.${encodeURIComponent(raceId)}`;
export function normalizePresets(raw: unknown, drivers: number[]): MapPreset[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  return raw
    .filter((item): item is MapPreset => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        !item.id ||
        item.id.length > 80 ||
        ids.has(item.id) ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        item.name.length > 32 ||
        !item.layout ||
        typeof item.layout !== "object"
      )
        return false;
      ids.add(item.id);
      return true;
    })
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name.trim(),
      layout: normalizeLayout(p.layout, drivers),
    }));
}
export function readPresets(raceId: string, drivers: number[]): MapPreset[] {
  try {
    return normalizePresets(
      JSON.parse(localStorage.getItem(presetsKey(raceId)) ?? "null"),
      drivers,
    );
  } catch {
    return [];
  }
}
export function upsertPreset(
  presets: MapPreset[],
  name: string,
  layout: MapLayout,
): MapPreset[] {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 32)
    throw new Error("Use a layout name between 1 and 32 characters.");
  const existing = presets.find(
    (p) => p.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
  );
  if (!existing && presets.length >= 10)
    throw new Error("Ten layouts are saved. Delete one before adding another.");
  const preset = {
    id: existing?.id ?? crypto.randomUUID(),
    name: trimmed,
    layout,
  };
  return existing
    ? presets.map((p) => (p.id === existing.id ? preset : p))
    : [...presets, preset];
}

import { useState } from "react";
import type { MapLayout } from "./map-layout";
import {
  readPresets,
  presetsKey,
  upsertPreset,
  type MapPreset,
} from "./map-presets";
export default function MapPresets({
  raceId,
  drivers,
  current,
  onLoad,
}: {
  raceId: string;
  drivers: number[];
  current: MapLayout;
  onLoad: (layout: MapLayout) => void;
}) {
  const [presets, setPresets] = useState(() => readPresets(raceId, drivers));
  const [name, setName] = useState(""),
    [selected, setSelected] = useState(""),
    [message, setMessage] = useState("");
  function write(next: MapPreset[]) {
    localStorage.setItem(presetsKey(raceId), JSON.stringify(next));
    setPresets(next);
  }
  return (
    <section className="map-presets" aria-label="Named map layouts">
      <div className="lab-field">
        <label htmlFor="preset-name">
          Named layouts · this browser / this race
        </label>
        <input
          id="preset-name"
          aria-label="Layout name"
          placeholder="e.g. Ferrari battle"
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button
        className="lab-button"
        disabled={!name.trim()}
        onClick={() => {
          try {
            const next = upsertPreset(presets, name, current);
            write(next);
            setSelected(
              next.find(
                (p) =>
                  p.name.toLocaleLowerCase() ===
                  name.trim().toLocaleLowerCase(),
              )!.id,
            );
            setName("");
            setMessage(
              "Named layout saved. Reusing a name replaces that layout.",
            );
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        Save named layout
      </button>
      <select
        className="lab-input"
        aria-label="Saved layouts"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Choose a layout</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        className="lab-button"
        disabled={!selected}
        onClick={() => {
          const p = presets.find((p) => p.id === selected);
          if (p) {
            onLoad(p.layout);
            setMessage(
              `${p.name} loaded. Save layout to make it your default view.`,
            );
          }
        }}
      >
        Load layout
      </button>
      <button
        className="lab-button"
        disabled={!selected}
        onClick={() => {
          try {
            write(presets.filter((p) => p.id !== selected));
            setSelected("");
            setMessage("Named layout deleted.");
          } catch {
            setMessage(
              "Browser storage is unavailable. The layout was not deleted.",
            );
          }
        }}
      >
        Delete layout
      </button>
      <p role="status">{message}</p>
    </section>
  );
}

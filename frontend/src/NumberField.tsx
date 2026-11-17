import { useEffect, useState } from "react";
// Keep incomplete typing local. Valid values update the model immediately;
// bounds apply on blur so entering e.g. 22 never turns the first digit into 5.
export default function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  function commit() {
    const parsed = text.trim() === "" ? value : Number(text);
    const bounded = Math.max(
      min,
      Math.min(max, Number.isFinite(parsed) ? parsed : value),
    );
    const next = step === 1 ? Math.round(bounded) : bounded;
    setText(String(next));
    if (next !== value) onChange(next);
  }
  return (
    <input
      aria-label={label}
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = Number(raw);
        if (
          n !== value &&
          raw.trim() &&
          Number.isFinite(n) &&
          n >= min &&
          n <= max &&
          (step !== 1 || Number.isInteger(n))
        )
          onChange(n);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}

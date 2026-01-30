"use client";

import { generateTimeSlots, minToTimeStr } from "@/lib/constants";

interface TimeSelectProps {
  value: number | null;
  onChange: (value: number) => void;
  label?: string;
  minTime?: number;
  maxTime?: number;
  disabled?: boolean;
}

export default function TimeSelect({
  value,
  onChange,
  label,
  minTime,
  maxTime,
  disabled = false,
}: TimeSelectProps) {
  const slots = generateTimeSlots().filter((slot) => {
    if (minTime !== undefined && slot.value < minTime) return false;
    if (maxTime !== undefined && slot.value > maxTime) return false;
    return true;
  });

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input"
        disabled={disabled}
      >
        <option value="">選択してください</option>
        {slots.map((slot) => (
          <option key={slot.value} value={slot.value}>
            {slot.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface TimeRangeDisplayProps {
  startMin: number | null;
  endMin: number | null;
}

export function TimeRangeDisplay({ startMin, endMin }: TimeRangeDisplayProps) {
  if (startMin === null || endMin === null) return <span>-</span>;
  return (
    <span>
      {minToTimeStr(startMin)}-{minToTimeStr(endMin)}
    </span>
  );
}

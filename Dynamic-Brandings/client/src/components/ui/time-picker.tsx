import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [hours, minutes] = value ? value.split(":") : ["09", "00"];
  const parsedHour = parseInt(hours);
  const hour24 = isNaN(parsedHour) ? 9 : parsedHour;
  const min = parseInt(minutes) || 0;

  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;

  const handleHourChange = (newHour: string) => {
    let h = parseInt(newHour);
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    const formatted = `${h.toString().padStart(2, "0")}:${minutes}`;
    onChange(formatted);
  };

  const handleMinuteChange = (newMinute: string) => {
    const formatted = `${hours}:${newMinute}`;
    onChange(formatted);
  };

  const handlePeriodChange = (period: string) => {
    let h = parseInt(hours);
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h >= 12) h -= 12;
    const formatted = `${h.toString().padStart(2, "0")}:${minutes}`;
    onChange(formatted);
  };

  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const h = i + 1;
    return h.toString().padStart(2, "0");
  });

  const minuteOptions = Array.from({ length: 12 }, (_, i) => {
    const m = i * 5;
    return m.toString().padStart(2, "0");
  });

  return (
    <div className={`flex items-center gap-1 w-full ${className}`}>
      <Select value={hour12.toString().padStart(2, "0")} onValueChange={handleHourChange}>
        <SelectTrigger className="flex-1 h-9 px-2">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>
          {hourOptions.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground font-bold">:</span>

      <Select value={min.toString().padStart(2, "0")} onValueChange={handleMinuteChange}>
        <SelectTrigger className="flex-1 h-9 px-2">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>
          {minuteOptions.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={isPM ? "PM" : "AM"} onValueChange={handlePeriodChange}>
        <SelectTrigger className="flex-1 h-9 px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

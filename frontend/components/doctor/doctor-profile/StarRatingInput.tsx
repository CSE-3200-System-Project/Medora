"use client";

import React from "react";
import { Star } from "lucide-react";

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  size?: number;
}

export function StarRatingInput({ value, onChange, disabled = false, size = 32 }: StarRatingInputProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const active = hover ?? value;

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= active;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => !disabled && setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => !disabled && onChange(n)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Star
              style={{ width: size, height: size }}
              className={
                filled
                  ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                  : "text-muted-foreground/50"
              }
            />
          </button>
        );
      })}
    </div>
  );
}

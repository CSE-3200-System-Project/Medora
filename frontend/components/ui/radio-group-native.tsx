import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioOption {
  label: string
  value: string
}

interface RadioGroupProps extends Omit<React.ComponentProps<"div">, "onChange"> {
  name: string
  options: RadioOption[]
  value?: string
  onChange?: (value: string) => void
}

function RadioGroup({ className, name, options, value, onChange, ...props }: RadioGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex items-center gap-2 rounded-md border p-3 transition-colors cursor-pointer hover:bg-muted/50",
            value === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input"
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange?.(e.target.value)}
            className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
          />
          <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}

export { RadioGroup }

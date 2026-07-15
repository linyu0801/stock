import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  className?: string;
};

const Select: React.FC<Props> = ({ value, onValueChange, options, className }) => (
  <SelectPrimitive.Root items={options} value={value} onValueChange={v => onValueChange(v as string)}>
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "h-8 w-full inline-flex items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none select-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-ring dark:bg-input/30",
        className
      )}
    >
      <SelectPrimitive.Value className="truncate" />
      <SelectPrimitive.Icon className="text-muted-foreground shrink-0">
        <ChevronDown size={14} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} className="z-50">
        <SelectPrimitive.Popup className="min-w-[var(--anchor-width)] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1">
          {options.map(o => (
            <SelectPrimitive.Item
              key={o.value}
              value={o.value}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm cursor-pointer outline-none data-[highlighted]:bg-muted"
            >
              <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="text-primary">
                <Check size={14} />
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);

export { Select };
export type { Option as SelectOption };

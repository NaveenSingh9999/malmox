import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-8 w-full rounded-md border border-line-strong bg-panel-2 px-2.5 py-1 text-[13px] text-ink transition-colors placeholder:text-faint focus-visible:border-accent disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };

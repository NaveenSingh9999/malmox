import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "dim",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "dim" | "accent" | "ok" | "warn" | "bad";
}) {
  const tones = {
    dim: "border-line-strong text-dim",
    accent: "border-accent/40 text-accent bg-accent/10",
    ok: "border-ok/40 text-ok bg-ok/10",
    warn: "border-warn/40 text-warn bg-warn/10",
    bad: "border-bad/40 text-bad bg-bad/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

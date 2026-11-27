import * as React from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-xl border border-ip-line bg-white px-3 text-sm text-ip-ink placeholder:text-ip-muted/70 transition-colors focus:border-ip-teal focus:outline-none focus:ring-2 focus:ring-ip-cyan/50 disabled:bg-ip-mist disabled:text-ip-muted aria-[invalid=true]:border-red-600";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlBase, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(controlBase, "min-h-24 py-2.5", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(controlBase, "h-10 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error wrapper. The control must use `id` (and `aria-describedby={id + "-msg"}`). */
export function Field({ id, label, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ip-ink">
        {label}
        {required && (
          <span className="text-red-700" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {(error || hint) && (
        <p id={`${id}-msg`} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-red-700" : "text-ip-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

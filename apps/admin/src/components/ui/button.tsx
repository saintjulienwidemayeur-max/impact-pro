import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        sun: "bg-ip-sun text-ip-ink hover:bg-ip-sun-600",
        teal: "bg-ip-teal text-white hover:bg-ip-teal-600",
        ink: "bg-ip-ink text-white hover:bg-ip-deep",
        outline: "border-2 border-ip-teal text-ip-teal hover:bg-ip-teal hover:text-white",
        outlineLight: "border-2 border-white/80 text-white hover:bg-white hover:text-ip-teal",
        ghost: "text-ip-ink hover:bg-ip-mist",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "teal", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

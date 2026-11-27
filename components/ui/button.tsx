import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-sm font-bold",
        primary: "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm font-bold",
        destructive: "bg-rose-600 text-white hover:bg-rose-500 shadow-sm font-bold",
        outline:
          "border border-zinc-300 dark:border-zinc-700 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100",
        secondary:
          "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700",
        ghost:
          "hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white",
        link: "text-amber-500 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-md px-2.5 text-[11px]",
        lg: "h-11 rounded-lg px-5 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

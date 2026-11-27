"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] aven-fade-in", className)}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" }
>(({ side = "left", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col gap-4 bg-[#111113] text-zinc-100 border-zinc-800 shadow-2xl transition-transform duration-250 ease-out inset-y-0 w-72 max-w-[85vw]",
        side === "left" ? "left-0 border-r aven-slide-in-left" : "right-0 border-l",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500">
        <X className="h-4 w-4" />
        <span className="sr-only">Close navigation</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetTrigger, SheetClose, SheetContent };

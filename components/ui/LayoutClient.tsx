"use client";

import { Toaster } from "sonner";
import { ScrollProgress } from "./ScrollProgress";

export function LayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ScrollProgress />
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        richColors
      />
    </>
  );
}

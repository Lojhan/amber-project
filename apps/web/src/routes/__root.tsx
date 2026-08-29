import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "../components/AppShell";
import { TooltipProvider } from "../components/ui/tooltip";
import "../styles/app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: "Procurement review — Valden" }],
    links: [
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3EV%3C/text%3E%3C/svg%3E",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <Document>
      <AppShell>
        <Outlet />
      </AppShell>
    </Document>
  );
}

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}

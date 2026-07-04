import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>Expense Tracker</title>
        <meta
          name="description"
          content="A simple expense tracker for salary and self-employed people."
        />
        <meta name="theme-color" content="#16A34A" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/adaptive-icon-foreground.png" />
        <link rel="icon" href="/favicon.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

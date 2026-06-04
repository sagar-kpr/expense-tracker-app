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
        <meta name="theme-color" content="#16A34A" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/web-app-icon.png" />
        <link rel="icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

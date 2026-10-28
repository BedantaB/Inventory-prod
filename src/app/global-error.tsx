"use client";

import { useEffect } from "react";
import { en } from "@/i18n/en";

/**
 * Last-resort error page (when even the main layout fails). It replaces the whole document,
 * so it can't use the app's styles or text provider — plain inline styles and the English text.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <title>{en.common.somethingWrong}</title>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24 }}>{en.common.somethingWrong}</h1>
          <p style={{ fontSize: 16, color: "#444" }}>{en.common.somethingWrongBody}</p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: 16,
              minHeight: 48,
              padding: "0 24px",
              fontSize: 18,
              borderRadius: 10,
              border: "none",
              background: "#1d4ed8",
              color: "#fff",
            }}
          >
            {en.common.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}

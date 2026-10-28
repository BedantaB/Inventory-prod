"use client";

import { Fragment, useState } from "react";

/**
 * For "add new" forms: after a save, swap in a brand-new copy of the form.
 * Next keeps recently visited pages alive in the background, so without this, coming back to
 * "Add Stock" or "New item" would still show what was just saved (and invite saving it twice).
 */
export function FreshForm({ children }: { children: (onSaved: () => void) => React.ReactNode }) {
  const [version, setVersion] = useState(0);
  return <Fragment key={version}>{children(() => setVersion((v) => v + 1))}</Fragment>;
}

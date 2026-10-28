"use client";

import { createContext, use, useCallback } from "react";
import { translate, type MessageKey, type MessageVars, type Messages } from "./index";

const MessagesContext = createContext<Messages | null>(null);

export function I18nProvider({
  messages,
  children,
}: {
  messages: Messages;
  children: React.ReactNode;
}) {
  return <MessagesContext value={messages}>{children}</MessagesContext>;
}

/** All UI text, for client components. */
export function useMessages(): Messages {
  const messages = use(MessagesContext);
  if (!messages) throw new Error("useMessages must be used inside <I18nProvider>");
  return messages;
}

/** Translate a dotted key (e.g. from a server action result). */
export function useT() {
  const messages = useMessages();
  return useCallback(
    (key: MessageKey | (string & {}), vars?: MessageVars) => translate(messages, key, vars),
    [messages],
  );
}

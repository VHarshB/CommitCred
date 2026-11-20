"use client";

import { useEffect, useRef, useState } from "react";

interface Turnstile {
  render(node: HTMLElement, config: Record<string, unknown>): string;
  remove(id: string): void;
}

declare global {
  interface Window { turnstile?: Turnstile }
}

let script: Promise<Turnstile> | undefined;

function loadTurnstile() {
  if (!script) {
    script = new Promise<Turnstile>((resolve, reject) => {
      const element = document.createElement("script");
      element.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      element.async = true;
      element.addEventListener("load", () => window.turnstile ? resolve(window.turnstile) : reject(new Error()));
      element.addEventListener("error", () => { element.remove(); reject(new Error()); });
      document.head.append(element);
    }).catch((error) => {
      script = undefined;
      throw error;
    });
  }
  return script;
}

export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const node = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let widget: string | undefined;
    let sdk: Turnstile | undefined;
    loadTurnstile().then((client) => {
      if (!active || !node.current) return;
      sdk = client;
      widget = client.render(node.current, {
        sitekey: siteKey, size: "flexible",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => { onToken(""); if (active) setFailed(true); },
      });
    }).catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (widget !== undefined) sdk?.remove(widget);
    };
  }, [onToken, siteKey]);
  return <><div ref={node}/>{failed && <p role="alert">Verification could not load. Close and reopen this dialog, or continue with Basic Report.</p>}</>;
}

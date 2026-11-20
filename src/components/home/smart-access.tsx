"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSmartStatus, smartDisabled, updateSmartSession, type SmartAccessStatus } from "../../lib/auth/browser";
import { TurnstileWidget } from "./turnstile";

type Panel = "consent" | "credits" | "invite" | "signin";

export function useSmartAccess(configured: boolean) {
  const [access, setAccess] = useState<SmartAccessStatus>(smartDisabled);
  const [notice, setNotice] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return smartDisabled;
    try {
      const result = await getSmartStatus();
      setAccess(result);
      return result;
    } catch {
      setAccess(smartDisabled);
      return smartDisabled;
    }
  }, [configured]);

  useEffect(() => {
    const onFocus = () => { void refresh(); };

    window.addEventListener("focus", onFocus);
    const url = new URL(window.location.href);
    const google = url.searchParams.get("google");
    queueMicrotask(() => {
      void refresh().then((status) => {
        if (!google) return;
        setNotice(google === "connected" && status.session === "google" ? "Google account connected. Your current credits are shown below." :
          google === "conflict" ? "That Google account is already registered. Sign in to its existing balance. This guest session cannot be moved to it." :
            "Google sign-in was not completed. Try again or continue with Basic Report.");
      });
    });
    if (google) {
      url.searchParams.delete("google");
      window.history.replaceState(window.history.state, "", url);
    }
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { access, refresh, notice, setNotice, panel, setPanel };
}

export function SmartAccess({ controls, onBasic, onConsent }: {
  controls: ReturnType<typeof useSmartAccess>;
  onBasic: () => void;
  onConsent: () => void;
}) {
  const { access, refresh, notice, setNotice, panel, setPanel } = controls;
  const dialog = useRef<HTMLDialogElement>(null);
  const isOpen = panel !== null;
  useEffect(() => {
    const element = dialog.current;
    if (isOpen && !element?.open) element?.showModal();
    if (!isOpen && element?.open) element.close();
  }, [isOpen]);

  const google = access.session === "google";
  const count = access.session === "none" ? 3 : access.totalRemaining ?? 0;
  return <>
    {notice && <p className="field-help" role="status">{notice}</p>}
    {access.inviteRequired && <button type="button" className="text-button" onClick={() => setPanel("invite")}>Enter private beta invitation</button>}
    {access.enabled && <div className="smart-account">
      <p className="field-help" aria-live="polite">{count} Smart Report {count === 1 ? "credit" : "credits"} {access.session === "none" ? "for a new guest" : "remaining"} · {google ? "Google account" : "Guest"}</p>
      {google ? <button type="button" className="text-button" onClick={async () => {
        try { await updateSmartSession({ action: "signout" }); onBasic(); await refresh(); setNotice("Signed out."); }
        catch { setNotice("Could not sign out. Try again."); }
      }}>Sign out</button> : <button type="button" className="text-button" onClick={() => setPanel(access.session === "guest" ? "credits" : "signin")}>Google sign-in</button>}
    </div>}
    <dialog className="card smart-dialog" ref={dialog} aria-labelledby="smart-dialog-title" onCancel={() => setPanel(null)}>
      {panel && <SmartPanel key={panel} panel={panel} access={access} onClose={() => setPanel(null)} onBasic={() => { setPanel(null); onBasic(); }}
        onUpdate={async (continueReport) => { setPanel(null); const status = await refresh(); if (continueReport && status.consented) onConsent(); }}/>}
    </dialog>
  </>;
}

function SmartPanel({ panel, access, onClose, onBasic, onUpdate }: {
  panel: Panel; access: SmartAccessStatus; onClose: () => void; onBasic: () => void;
  onUpdate: (continueReport: boolean) => Promise<void>;
}) {
  const [adult, setAdult] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [challenge, setChallenge] = useState(0);
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const requiresCaptcha = access.session === "none" || (access.session === "guest" && !access.consented && !access.guestRemaining);
  const google = access.session === "google";
  const remaining = access.totalRemaining ?? 0;
  const title = panel === "consent" ? "Before your first Smart Report" :
    panel === "invite" ? "Private Smart Report beta" :
    panel === "signin" ? "Sign in with Google" :
    access.usedAllSix ? "All 6 introductory AI reports have been used" :
    google ? "You have no Smart Report credits left" :
    remaining === 0 ? "You’ve used your 3 free AI reports" : "Get 3 more Smart Reports";

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setFailure("");
    try {
      const result = await updateSmartSession(body);
      if (result.redirect) window.location.assign(result.redirect);
      else await onUpdate(body.action === "consent");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Please try again.");
      if (body.action === "consent") { setCaptcha(""); setChallenge((value) => value + 1); }
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="smart-dialog-heading"><h2 id="smart-dialog-title">{title}</h2><button type="button" className="button icon-button" aria-label="Close" onClick={onClose}>×</button></div>
    {panel === "invite" ? <>
      <label htmlFor="beta-code">Invitation code</label>
      <input id="beta-code" type="password" value={code} maxLength={160} onChange={(event) => setCode(event.target.value)}/>
      <button type="button" className="button primary" disabled={!code || busy} onClick={() => void act({ action: "invite", code })}>Open private beta</button>
    </> : panel === "consent" ? <>
      <p>CommitCred sends a limited set of public commit evidence to Gemini. Google may use free-tier requests and responses to improve its products and may use human reviewers. Use Basic Report if the work contains sensitive or personal information.</p>
      <label className="smart-check"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)}/> I’m 18 or older and located in the United States.</label>
      <label className="smart-check"><input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)}/> I understand the data use and agree to send sanitized public evidence to Gemini.</label>
      {requiresCaptcha && access.siteKey && <TurnstileWidget key={challenge} siteKey={access.siteKey} onToken={setCaptcha}/>}
      <button type="button" className="button primary" disabled={!adult || !privacy || busy || (requiresCaptcha && !captcha)}
        onClick={() => void act({ action: "consent", adult, privacy, eligible: adult, ...(captcha ? { captcha } : {}) })}>Agree and continue</button>
    </> : !google && <>
      <p>{panel === "signin" ? "A new Google account gets 3 one-time credits. Returning accounts keep their existing balance." :
        "Link a new Google identity to keep this guest wallet and add 3 credits once. If you already have an account, sign in to its existing balance. Unlinked guest credits cannot be moved."}</p>
      <button type="button" className="button primary" disabled={busy}
        onClick={() => void act({ action: "google", intent: panel === "signin" ? "signin" : "link" })}>
        {panel === "signin" ? "Continue with Google" : "Continue with Google — get 3 more"}
      </button>
      {panel === "credits" && <button type="button" className="text-button" disabled={busy} onClick={() => void act({ action: "google", intent: "signin" })}>Sign in to an existing account</button>}
    </>}
    {failure && <p className="notice error" role="alert">{failure}</p>}
    <button type="button" className="button secondary" onClick={onBasic}>Continue with Basic Report</button>
  </>;
}

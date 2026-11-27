"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { PrimaryButton } from "@/components/ui";
import { t } from "@/i18n/fr";
import { authErrorMessage } from "@/lib/auth/errors";
import { ENABLED_OAUTH_PROVIDERS, type OAuthProvider } from "@/lib/auth/providers";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { emailSchema, passwordSchema } from "@/lib/validation/profile";

const PROVIDER_ICONS: Record<OAuthProvider, ReactNode> = {
  google: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  ),
  apple: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-.9-2.3-4.3zM14 5.4c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  ),
};

type Status = { kind: "idle" } | { kind: "pending" } | { kind: "error" | "info"; message: string };
type Mode = "code" | "password";

/**
 * Mode de connexion : le mot de passe par défaut (aucun email nécessaire, et le
 * navigateur remplit email et mot de passe), le code reçu par email en option. Le
 * dernier mode choisi est gardé sur l'appareil.
 */
const MODE_KEY = "spot-tomi:connexion";
const DEFAULT_MODE: Mode = "password";

function readStoredMode(): Mode | null {
  try {
    const value = window.localStorage.getItem(MODE_KEY);
    if (value === "password" || value === "code") return value;
    // Ancien nom du mode par email (lien magique), remplacé par le code.
    return value === "magic" ? "code" : null;
  } catch {
    return null;
  }
}

function storeMode(mode: Mode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Stockage indisponible (navigation privée) : on garde le mode par défaut.
  }
}

const noSubscription = () => () => {};

/** Code à usage unique envoyé par email (otp_length, supabase/auth.json). */
const CODE_LENGTH = 6;

const input =
  "min-h-12 w-full rounded-[14px] border border-line bg-card px-4 text-base text-text placeholder:text-muted focus:outline-3 focus:outline-offset-1 focus:outline-text";
const secondary =
  "flex min-h-12 w-full items-center justify-center gap-3 rounded-[14px] border border-line bg-card px-4 text-[15px] font-semibold text-text shadow-card disabled:opacity-50";

/**
 * Connexion : code reçu par email ou mot de passe, et Google / Apple quand ils sont
 * activés dans src/lib/auth/providers.ts (Supabase Auth).
 *
 * Le code se tape dans la page qui l'a demandé : il marche aussi dans l'app
 * installée sur l'écran d'accueil d'un iPhone, dont le stockage est séparé de
 * Safari (où s'ouvrent les liens des emails). L'email garde un lien, pour qui
 * l'ouvre dans le même navigateur.
 * Tous les retours passent par /auth/callback, qui vérifie le pseudo.
 */
export function LoginForm({ next }: { next: string }) {
  const storedMode = useSyncExternalStore(noSubscription, readStoredMode, () => null);
  const [chosenMode, setMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? storedMode ?? DEFAULT_MODE;
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  /** Adresse à laquelle le code a été envoyé : la page attend alors le code. */
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const pending = status.kind === "pending";

  function goToCallback() {
    // Passe par le callback (route serveur, donc rechargement complet) pour vérifier le pseudo.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/auth/callback?next=${encodeURIComponent(next)}`);
  }

  function callbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function oauth(provider: OAuthProvider) {
    setStatus({ kind: "pending" });
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (error) setStatus({ kind: "error", message: authErrorMessage(error) });
  }

  async function sendCode(email: string) {
    setStatus({ kind: "pending" });
    const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      if (error.code === "over_email_send_rate_limit") {
        // Envoi d'emails limité : le mot de passe n'en a pas besoin.
        setMode("password");
        setCodeSentTo(null);
      }
      setStatus({ kind: "error", message: authErrorMessage(error) });
      return;
    }
    setCodeSentTo(email);
    setStatus({ kind: "info", message: t.auth.codeSent(email) });
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>, email: string) {
    event.preventDefault();
    const token = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(token)) {
      setStatus({ kind: "error", message: t.auth.codeInvalid });
      return;
    }
    setStatus({ kind: "pending" });
    const { error } = await getSupabaseBrowserClient().auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      setStatus({ kind: "error", message: authErrorMessage(error) });
      return;
    }
    storeMode("code");
    goToCallback();
  }

  async function submit(event: FormEvent<HTMLFormElement>, action: "code" | "signIn" | "signUp") {
    event.preventDefault();
    const form = new FormData(event.currentTarget.form ?? event.currentTarget);
    const email = emailSchema.safeParse(String(form.get("email") ?? "").trim());
    if (!email.success) {
      setStatus({ kind: "error", message: t.auth.errors.email_address_invalid });
      return;
    }

    if (action === "code") {
      await sendCode(email.data);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    setStatus({ kind: "pending" });

    const password = passwordSchema.safeParse(String(form.get("password") ?? ""));
    if (!password.success) {
      setStatus({ kind: "error", message: t.auth.errors.weak_password });
      return;
    }

    if (action === "signIn") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.data,
        password: password.data,
      });
      if (error) {
        setStatus({ kind: "error", message: authErrorMessage(error) });
        return;
      }
      storeMode("password");
      goToCallback();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      setStatus({ kind: "error", message: authErrorMessage(error) });
    } else if (data.session) {
      goToCallback();
    } else {
      setStatus({ kind: "info", message: t.auth.signUpSent(email.data) });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {ENABLED_OAUTH_PROVIDERS.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {ENABLED_OAUTH_PROVIDERS.map((provider) => (
              <button
                key={provider}
                type="button"
                className={secondary}
                disabled={pending}
                onClick={() => oauth(provider)}
              >
                {PROVIDER_ICONS[provider]}
                {provider === "google" ? t.auth.google : t.auth.apple}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t.auth.or}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      {mode === "code" && codeSentTo ? (
        <form
          id="code-connexion"
          method="post"
          className="flex flex-col gap-3"
          onSubmit={(event) => verifyCode(event, codeSentTo)}
        >
          {/* « one-time-code » : iOS et Android proposent le code reçu au-dessus du clavier. */}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t.auth.code}
            <input
              key={codeSentTo}
              id="code"
              name="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              autoFocus
              aria-describedby="code-hint"
              className={`${input} text-center font-mono text-2xl tracking-[0.4em]`}
            />
            <span id="code-hint" className="text-xs font-normal text-muted">
              {t.auth.codeHint}
            </span>
          </label>
          <PrimaryButton type="submit" fullWidth disabled={pending}>
            {pending ? t.auth.pending : t.auth.verifyCode}
          </PrimaryButton>
          <div className="flex flex-wrap gap-x-5 text-sm">
            <button
              type="button"
              className="min-h-11 font-semibold underline underline-offset-4 disabled:opacity-50"
              disabled={pending}
              onClick={() => sendCode(codeSentTo)}
            >
              {t.auth.resendCode}
            </button>
            <button
              type="button"
              className="min-h-11 font-semibold underline underline-offset-4"
              onClick={() => {
                setCodeSentTo(null);
                setStatus({ kind: "idle" });
              }}
            >
              {t.auth.changeEmail}
            </button>
          </div>
        </form>
      ) : (
        <form
          id="connexion"
          method="post"
          className="flex flex-col gap-3"
          onSubmit={(event) => submit(event, mode === "code" ? "code" : "signIn")}
        >
          {/* « username » sur l'identifiant d'un formulaire de connexion : reconnu par les gestionnaires de mots de passe. */}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t.auth.email}
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder={t.auth.emailPlaceholder}
              className={input}
            />
          </label>

          {mode === "password" && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t.auth.password}
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
                aria-describedby="password-hint"
                className={input}
              />
              <span id="password-hint" className="text-xs font-normal text-muted">
                {t.auth.passwordHint}
              </span>
            </label>
          )}

          {mode === "code" ? (
            <PrimaryButton type="submit" fullWidth disabled={pending}>
              {pending ? t.auth.pending : t.auth.sendCode}
            </PrimaryButton>
          ) : (
            <div className="flex flex-col gap-2">
              <PrimaryButton type="submit" fullWidth disabled={pending}>
                {pending ? t.auth.pending : t.auth.signIn}
              </PrimaryButton>
              <button
                type="button"
                className={secondary}
                disabled={pending}
                onClick={(event) => submit(event as unknown as FormEvent<HTMLFormElement>, "signUp")}
              >
                {t.auth.signUp}
              </button>
            </div>
          )}
        </form>
      )}

      {status.kind === "error" || status.kind === "info" ? (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className="rounded-[14px] border border-line bg-card p-3 text-sm font-semibold"
        >
          {status.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 text-sm">
        <button
          type="button"
          className="min-h-11 self-start font-semibold underline underline-offset-4"
          onClick={() => {
            const nextMode = mode === "code" ? "password" : "code";
            setMode(nextMode);
            storeMode(nextMode);
            setCodeSentTo(null);
            setStatus({ kind: "idle" });
          }}
        >
          {mode === "code" ? t.auth.usePassword : t.auth.useCode}
        </button>
        {mode === "password" && <p className="text-muted">{t.auth.forgotPassword}</p>}
      </div>
    </div>
  );
}

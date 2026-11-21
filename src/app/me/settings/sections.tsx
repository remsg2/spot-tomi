"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import {
  AvatarField,
  HomeField,
  UsernameField,
  inputClass,
  secondaryButtonClass,
  uploadAvatar,
  type HomeState,
} from "@/components/account/fields";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { PrimaryButton } from "@/components/ui";
import { t } from "@/i18n/fr";
import { authErrorMessage } from "@/lib/auth/errors";
import { haptic, hapticsEnabled, hapticsSupported, setHapticsEnabled } from "@/lib/haptics";
import { isAppleMobile } from "@/lib/platform";
import { clearHome, saveHome, updateTheme, updateUsername } from "@/lib/profile/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validation/profile";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-card p-5">
      <h2 className="font-display text-lg font-normal">{title}</h2>
      {children}
    </section>
  );
}

function Feedback({ message, error }: { message: string | null; error?: boolean }) {
  if (!message) return null;
  return (
    <p role={error ? "alert" : "status"} className="text-sm font-semibold">
      {message}
    </p>
  );
}

export function UsernameSection({ current }: { current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateUsername(value);
      setMessage(result.ok ? { text: t.settings.saved, error: false } : { text: result.message, error: true });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Section title={t.profile.username}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <UsernameField value={value} onChange={setValue} current={current} />
        <PrimaryButton type="submit" disabled={pending || value.trim() === current}>
          {t.settings.save}
        </PrimaryButton>
        <Feedback message={message?.text ?? null} error={message?.error} />
      </form>
    </Section>
  );
}

export function AvatarSection({
  userId,
  username,
  avatarPath,
  avatarUrl,
}: {
  userId: string;
  username: string;
  avatarPath: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!file) return;
    startTransition(async () => {
      try {
        await uploadAvatar(userId, file, avatarPath);
        setFile(null);
        setMessage({ text: t.settings.saved, error: false });
        router.refresh();
      } catch {
        setMessage({ text: t.auth.errors.default, error: true });
      }
    });
  }

  function remove() {
    if (!avatarPath) return;
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
      if (!error) await supabase.storage.from("avatars").remove([avatarPath]);
      setMessage(error ? { text: t.auth.errors.default, error: true } : { text: t.settings.saved, error: false });
      router.refresh();
    });
  }

  return (
    <Section title={t.profile.avatar}>
      <AvatarField username={username} file={file} onChange={setFile} currentUrl={avatarUrl} label={t.profile.avatar} />
      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="button" onClick={save} disabled={pending || !file}>
          {t.settings.save}
        </PrimaryButton>
        {avatarPath && (
          <button type="button" onClick={remove} disabled={pending} className={secondaryButtonClass}>
            {t.profile.avatarRemove}
          </button>
        )}
      </div>
      <Feedback message={message?.text ?? null} error={message?.error} />
    </Section>
  );
}

export function HomeSection({ hasHome }: { hasHome: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<HomeState>({ kind: "none" });
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (state.kind !== "ready") return;
    startTransition(async () => {
      const result = await saveHome({ lat: state.lat, lng: state.lng });
      setMessage(result.ok ? { text: t.profile.homeSet, error: false } : { text: result.message, error: true });
      if (result.ok) {
        setState({ kind: "none" });
        router.refresh();
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await clearHome();
      setMessage(result.ok ? { text: t.settings.saved, error: false } : { text: result.message, error: true });
      router.refresh();
    });
  }

  return (
    <Section title={t.profile.home}>
      <p className="text-sm font-semibold">{hasHome ? t.profile.homeSet : t.profile.homeNone}</p>
      <HomeField state={state} onChange={setState} />
      <div className="flex flex-wrap gap-2">
        {state.kind === "ready" && (
          <PrimaryButton type="button" onClick={save} disabled={pending}>
            {t.settings.save}
          </PrimaryButton>
        )}
        {hasHome && (
          <button type="button" onClick={remove} disabled={pending} className={secondaryButtonClass}>
            {t.profile.homeRemove}
          </button>
        )}
      </div>
      <Feedback message={message?.text ?? null} error={message?.error} />
    </Section>
  );
}

/** Le thème s'applique tout de suite sur l'appareil et s'enregistre dans le profil. */
export function ThemeSection() {
  const [, startTransition] = useTransition();
  return (
    <Section title={t.settings.theme}>
      <ThemeSwitcher
        onChange={(value) =>
          startTransition(async () => {
            await updateTheme(value);
          })
        }
      />
    </Section>
  );
}

const noSubscription = () => () => {};

/** Vibrations de l'app : réglage gardé sur l'appareil (src/lib/haptics.ts). Affiché si l'appareil vibre. */
export function VibrationsSection() {
  const supported = useSyncExternalStore(noSubscription, hapticsSupported, () => false);
  const stored = useSyncExternalStore(noSubscription, hapticsEnabled, () => true);
  const [choice, setChoice] = useState<boolean | null>(null);
  const enabled = choice ?? stored;
  if (!supported) return null;

  function toggle() {
    const next = !enabled;
    setHapticsEnabled(next);
    setChoice(next);
    if (next) haptic("success");
  }

  return (
    <Section title={t.settings.vibrations}>
      <p className="text-sm text-muted">
        {t.settings.vibrationsIntro} {isAppleMobile() && t.settings.vibrationsIos}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        className="flex min-h-11 items-center justify-between gap-3 self-stretch rounded-[14px] border border-line bg-bg px-4 text-sm font-semibold"
      >
        {t.settings.vibrationsToggle}
        <span
          aria-hidden="true"
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-year" : "bg-line"}`}
        >
          <span
            className={`absolute top-1 size-5 rounded-full bg-card shadow transition-[left] ${enabled ? "left-6" : "left-1"}`}
          />
        </span>
      </button>
    </Section>
  );
}

export function PasswordSection({ email }: { email: string }) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = passwordSchema.safeParse(String(new FormData(form).get("password") ?? ""));
    if (!password.success) {
      setMessage({ text: t.auth.errors.weak_password, error: true });
      return;
    }
    startTransition(async () => {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password: password.data });
      setMessage(error ? { text: authErrorMessage(error), error: true } : { text: t.settings.passwordSaved, error: false });
      if (!error) form.reset();
    });
  }

  return (
    <Section title={t.settings.password}>
      <p className="text-sm text-muted">{t.settings.passwordIntro}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {/* Identifiant (invisible) : le gestionnaire de mots de passe enregistre le nouveau avec le bon compte. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.auth.password}
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={inputClass}
          />
          <span className="text-xs font-normal text-muted">{t.auth.passwordHint}</span>
        </label>
        <button type="submit" disabled={pending} className={`${secondaryButtonClass} self-start`}>
          {t.settings.passwordSave}
        </button>
        <Feedback message={message?.text ?? null} error={message?.error} />
      </form>
    </Section>
  );
}

/** Suppression définitive : Edge Function delete-account (photos, stickers, profil, compte). */
export function DeleteAccountSection({ username }: { username: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== username) return;
    setError(null);
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error: invokeError } = await supabase.functions.invoke("delete-account", { method: "POST" });
      if (invokeError) {
        setError(t.settings.deleteError);
        return;
      }
      await supabase.auth.signOut();
      // Rechargement complet : plus aucun état de l'ancien compte côté client.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    });
  }

  return (
    <Section title={t.settings.deleteTitle}>
      <p className="text-sm text-muted">{t.settings.deleteIntro}</p>
      <form onSubmit={remove} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t.settings.deleteConfirm(username)}
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending || confirmation !== username}
          className="inline-flex min-h-12 items-center justify-center rounded-[14px] bg-band px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? t.settings.deleting : t.settings.deleteButton}
        </button>
        <Feedback message={error} error />
      </form>
    </Section>
  );
}

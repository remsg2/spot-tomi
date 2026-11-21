"use client";

import { useEffect, useState } from "react";
import { t } from "@/i18n/fr";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AVATAR_MAX_BYTES, USERNAME_PATTERN } from "@/lib/validation/profile";
import { Avatar } from "./avatar";

export const inputClass =
  "min-h-12 w-full rounded-[14px] border border-line bg-card px-4 text-base text-text placeholder:text-muted focus:outline-3 focus:outline-offset-1 focus:outline-text";
export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[14px] border border-line bg-card px-4 text-sm font-semibold text-text disabled:opacity-50";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

/** Pseudo avec vérification de disponibilité pendant la saisie. */
export function UsernameField({
  value,
  onChange,
  current,
}: {
  value: string;
  onChange: (value: string) => void;
  current?: string;
}) {
  const [availability, setAvailability] = useState<Availability>("idle");
  const trimmed = value.trim();
  const unchanged = current !== undefined && trimmed.toLowerCase() === current.toLowerCase();
  const valid = USERNAME_PATTERN.test(trimmed);

  useEffect(() => {
    if (!trimmed || unchanged || !valid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAvailability("checking");
      const { data } = await getSupabaseBrowserClient().rpc("username_available", { candidate: trimmed });
      if (!cancelled) setAvailability(data ? "available" : "taken");
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, unchanged, valid]);

  const shown: Availability = !trimmed || unchanged ? "idle" : !valid ? "invalid" : availability;
  const message =
    shown === "invalid"
      ? t.profile.usernameInvalid
      : shown === "taken"
        ? t.profile.usernameTaken
        : shown === "available"
          ? t.profile.usernameAvailable
          : t.profile.usernameHint;

  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {t.profile.username}
      <input
        name="username"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        minLength={3}
        maxLength={20}
        required
        aria-invalid={shown === "invalid" || shown === "taken"}
        aria-describedby="username-help"
        className={inputClass}
      />
      <span
        id="username-help"
        aria-live="polite"
        className={shown === "invalid" || shown === "taken" ? "text-xs font-bold text-text" : "text-xs font-normal text-muted"}
      >
        {message}
      </span>
    </label>
  );
}

/** Choix d'une photo d'avatar, avec aperçu. */
export function AvatarField({
  username,
  file,
  onChange,
  currentUrl,
  label = t.profile.avatarOptional,
}: {
  username: string;
  file: File | null;
  onChange: (file: File | null) => void;
  currentUrl?: string | null;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Libère l'aperçu précédent quand il change ou quand le champ disparaît.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="flex items-center gap-4">
        <Avatar username={username || "?"} src={file ? preview : currentUrl} size={56} />
        <label className={`${secondaryButtonClass} cursor-pointer focus-within:outline-3 focus-within:outline-text`}>
          {t.profile.avatarChoose}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;
              setError(null);
              if (chosen && !chosen.type.startsWith("image/")) return setError(t.profile.avatarInvalid);
              if (chosen && chosen.size > AVATAR_MAX_BYTES) return setError(t.profile.avatarTooBig);
              setPreview(chosen ? URL.createObjectURL(chosen) : null);
              onChange(chosen);
            }}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-xs font-bold">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Envoie l'avatar réduit (256 px, WebP sans métadonnées) et l'associe au profil. */
export async function uploadAvatar(userId: string, file: File, previousPath: string | null): Promise<string> {
  const { squareWebp } = await import("@/lib/images/resize");
  const blob = await squareWebp(file, 256);
  const path = `${userId}/${Date.now()}.webp`;
  const supabase = getSupabaseBrowserClient();
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/webp", upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) throw error;
  if (previousPath) await supabase.storage.from("avatars").remove([previousPath]);
  return path;
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { AvatarField, UsernameField, uploadAvatar } from "@/components/account/fields";
import { PrimaryButton } from "@/components/ui";
import { t } from "@/i18n/fr";
import { createProfile } from "@/lib/profile/actions";

export function WelcomeForm({ userId, next }: { userId: string; next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProfile({ username });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (avatar) {
        // L'avatar est facultatif : un échec ici ne bloque pas l'inscription.
        await uploadAvatar(userId, avatar, null).catch(() => undefined);
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <UsernameField value={username} onChange={setUsername} />
      <AvatarField username={username} file={avatar} onChange={setAvatar} />
      {error && (
        <p role="alert" className="rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
          {error}
        </p>
      )}
      <PrimaryButton type="submit" fullWidth disabled={pending}>
        {pending ? t.auth.pending : t.welcome.submit}
      </PrimaryButton>
    </form>
  );
}

"use client";

import { PrimaryButton } from "@/components/ui";
import { tm } from "@/i18n/map.fr";

export function RetryButton() {
  return <PrimaryButton onClick={() => window.location.reload()}>{tm.pwa.retry}</PrimaryButton>;
}

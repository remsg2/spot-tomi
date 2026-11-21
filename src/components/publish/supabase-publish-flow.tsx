"use client";

import { useMemo } from "react";
import { createSupabaseServices } from "@/lib/publish/services";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PublishFlow, type PublishFlowProps } from "./publish-flow";

/** Parcours de publication branché sur Supabase (page /spots/new). */
export function SupabasePublishFlow(props: Omit<PublishFlowProps, "services">) {
  const services = useMemo(() => createSupabaseServices(getSupabaseBrowserClient), []);
  return <PublishFlow {...props} services={services} />;
}

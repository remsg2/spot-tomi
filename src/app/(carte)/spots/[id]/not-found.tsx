import Link from "next/link";
import { ShellPage } from "@/components/shell";
import { Sticker } from "@/components/ui";
import { tm } from "@/i18n/map.fr";

export default function SpotNotFound() {
  return (
    <ShellPage className="items-start pt-10 md:pt-4">
      <Sticker size={120} tilt={-5} />
      <h1 className="font-display text-3xl font-normal">{tm.spot.notFoundTitle}</h1>
      <p className="text-muted">{tm.spot.notFound}</p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-[14px] bg-soft px-4 font-semibold">
        {tm.spot.backHome}
      </Link>
    </ShellPage>
  );
}

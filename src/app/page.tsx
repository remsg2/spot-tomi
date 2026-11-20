import Image from "next/image";
import { t } from "@/i18n/fr";
import { TOMI_IMAGE } from "@/lib/tomi";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div
        className="relative aspect-square w-64 -rotate-3 overflow-hidden rounded-[10px] bg-year shadow-[0_1px_2px_rgba(0,0,0,0.2),0_10px_24px_rgba(0,0,0,0.22)]"
        aria-hidden="true"
      >
        <span className="font-display absolute top-[7%] left-[7%] text-[51px] leading-none text-band">
          TOMI
        </span>
        <Image
          src={TOMI_IMAGE.full.src}
          width={TOMI_IMAGE.full.width}
          height={TOMI_IMAGE.full.height}
          alt=""
          priority
          className="absolute inset-0 h-full w-full"
        />
        <span className="absolute inset-0 bg-band [clip-path:polygon(0_95%,100%_64%,100%_100%,0_100%)]" />
      </div>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl tracking-tight">{t.app.title}</h1>
        <p className="text-muted">{t.home.tagline}</p>
        <p className="text-sm text-muted">{t.home.comingSoon}</p>
      </div>
    </main>
  );
}

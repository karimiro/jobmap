"use client";

import dynamic from "next/dynamic";

// The map library needs the browser — load it only on the client side
const MapClient = dynamic(() => import("./MapClient"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-[#070d14]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400" />
        <p className="text-sm text-slate-400">جارٍ تحميل خريطة المغرب…</p>
      </div>
    </div>
  ),
});

export default function MapShell() {
  return <MapClient />;
}

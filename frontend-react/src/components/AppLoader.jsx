import React from "react";

export default function AppLoader({ gradient = "from-gray-400 via-gray-500 to-slate-600" }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div
            className={`h-16 w-16 rounded-full p-[3px] bg-gradient-to-r ${gradient} animate-spin`}
            aria-label="Cargando"
            role="status"
          >
            <div className="h-full w-full rounded-full bg-white/10 backdrop-blur-md" />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${gradient} opacity-40 blur-[10px]`} />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/90 font-semibold tracking-wide">CS</span>
          </div>
        </div>

        <div className="text-center">
          <div className={`text-2xl font-bold tracking-wide bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
            CalmaSense
          </div>
          <div className="text-sm text-white/80">Cargando…</div>
        </div>
      </div>
    </div>
  );
}

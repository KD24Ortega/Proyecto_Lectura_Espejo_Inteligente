import React, { useEffect } from "react";

const VARIANTS = {
  success: {
    icon: "✅",
    title: "Éxito",
    gradient: "from-green-500 to-emerald-500",
    ring: "ring-green-500/20",
  },
  error: {
    icon: "❌",
    title: "Error",
    gradient: "from-red-500 to-pink-500",
    ring: "ring-red-500/20",
  },
  warning: {
    icon: "⚠️",
    title: "Atención",
    gradient: "from-yellow-500 to-orange-500",
    ring: "ring-yellow-500/20",
  },
  info: {
    icon: "💡",
    title: "Información",
    gradient: "from-blue-500 to-indigo-500",
    ring: "ring-blue-500/20",
  },
};

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export default function UnifiedModal({
  isOpen,
  variant = "info",
  title,
  message,
  children,
  icon,
  size = "md",
  onClose,
  primaryAction,
  secondaryAction,
  closeOnBackdrop = true,
  closeOnEsc = true,
  hideFooter = false,
}) {
  const v = VARIANTS[variant] || VARIANTS.info;
  const resolvedTitle = title ?? v.title;
  const resolvedIcon = icon ?? v.icon;

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!closeOnEsc) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const modalSize = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const hasActions = Boolean(primaryAction || secondaryAction);
  const showFooter = !hideFooter && hasActions;

  const handleBackdropClick = () => {
    if (!closeOnBackdrop) return;
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={`relative w-full ${modalSize} overflow-hidden rounded-3xl bg-white/95 shadow-2xl ring-1 ${v.ring}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`h-1.5 w-full bg-gradient-to-r ${v.gradient}`} />

        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${v.gradient} text-2xl shadow-lg`}
                aria-hidden="true"
              >
                {resolvedIcon}
              </div>

              <div className="min-w-0">
                {resolvedTitle ? (
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {resolvedTitle}
                  </h3>
                ) : null}

                {children ? (
                  <div className="mt-2 text-gray-700 leading-relaxed">
                    {children}
                  </div>
                ) : message ? (
                  <p className="mt-2 text-gray-700 leading-relaxed">{message}</p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {showFooter ? (
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {secondaryAction ? (
                <button
                  type="button"
                  onClick={secondaryAction.onClick}
                  disabled={Boolean(secondaryAction.disabled)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {secondaryAction.label}
                </button>
              ) : null}

              {primaryAction ? (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  disabled={Boolean(primaryAction.disabled)}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl text-white font-semibold shadow-lg transition bg-gradient-to-r ${v.gradient} hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {primaryAction.loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="h-5 w-5 rounded-full border-2 border-white/90 border-t-transparent animate-spin" />
                      <span>{primaryAction.loadingLabel || "Cargando..."}</span>
                    </span>
                  ) : (
                    primaryAction.label
                  )}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, type HTMLMotionProps } from "framer-motion";
import { Loader2, X, type LucideIcon } from "lucide-react";
import { cn, initials } from "@/lib/utils";

/* ----------------------------- Button ----------------------------- */
type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: LucideIcon;
  children?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon: Icon, className, children, disabled, type = "button", ...props },
  ref
) {
  const variants = {
    primary: "bg-brand-gradient text-white shadow-glow hover:brightness-110",
    secondary: "glass text-fg hover:border-brand/50",
    ghost: "text-muted hover:bg-brand/10 hover:text-fg",
    danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
    success: "bg-success/15 text-success border border-success/30 hover:bg-success/25",
  };
  const sizes = {
    sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
    md: "h-10 gap-2 rounded-xl px-4 text-sm",
    lg: "h-12 gap-2 rounded-xl px-6 text-base",
    icon: "h-10 w-10 rounded-xl",
  };
  return (
    <motion.button
      ref={ref}
      type={type}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children}
    </motion.button>
  );
});

/* ------------------------------ Card ------------------------------ */
export function Card({
  className,
  hover,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cn("glass rounded-xl2 p-5 shadow-card", hover && "glass-hover", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  icon: Icon,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-fg">
        {Icon && <Icon className="h-4 w-4 text-brand" />}
        {children}
      </h3>
      {action}
    </div>
  );
}

/* ----------------------------- Inputs ----------------------------- */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }>(
  function Input({ label, hint, error, className, id, ...props }, ref) {
    const autoId = React.useId();
    const fieldId = id ?? autoId;
    return (
      <div>
        {label && (
          <label htmlFor={fieldId} className="label">
            {label}
          </label>
        )}
        <input ref={ref} id={fieldId} className={cn("field", error && "border-danger focus:border-danger focus:ring-danger/25", className)} {...props} />
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
    );
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(
  function Textarea({ label, className, id, ...props }, ref) {
    const autoId = React.useId();
    const fieldId = id ?? autoId;
    return (
      <div>
        {label && (
          <label htmlFor={fieldId} className="label">
            {label}
          </label>
        )}
        <textarea ref={ref} id={fieldId} rows={3} className={cn("field resize-y", className)} {...props} />
      </div>
    );
  }
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }>(
  function Select({ label, className, id, children, ...props }, ref) {
    const autoId = React.useId();
    const fieldId = id ?? autoId;
    return (
      <div>
        {label && (
          <label htmlFor={fieldId} className="label">
            {label}
          </label>
        )}
        <select ref={ref} id={fieldId} className={cn("field appearance-none pr-8", className)} {...props}>
          {children}
        </select>
      </div>
    );
  }
);

/* ------------------------------ Modal ----------------------------- */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className={cn(
              "glass max-h-[92vh] w-full overflow-y-auto rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl",
              "bg-surface/95",
              widths[size]
            )}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted transition hover:bg-brand/10 hover:text-fg">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => unknown;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              onClose();
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ----------------------------- Progress --------------------------- */
export function Progress({
  value,
  color,
  className,
  height = "h-2",
  showLabel,
}: {
  value: number;
  color?: string;
  className?: string;
  height?: string;
  showLabel?: boolean;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("w-full overflow-hidden rounded-full bg-line/15", height)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={cn("h-full rounded-full", !color && "bg-brand-gradient")}
          style={color ? { backgroundColor: color } : undefined}
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      {showLabel && <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">{Math.round(v)}%</span>}
    </div>
  );
}

/* ------------------------------ Badge ----------------------------- */
export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "success" | "warn" | "danger" | "muted" | "violet";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand/15 text-brand",
    success: "bg-success/15 text-success",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    violet: "bg-violet/15 text-violet",
    muted: "bg-line/15 text-muted",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

/* ------------------------------ Tabs ------------------------------ */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  id = "tabs",
  className,
}: {
  tabs: { value: T; label: string; icon?: LucideIcon; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("glass inline-flex max-w-full gap-1 overflow-x-auto rounded-xl p-1", className)} role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "text-white" : "text-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-lg bg-brand-gradient shadow-glow" transition={{ type: "spring", damping: 28, stiffness: 380 }} />
            )}
            <span className="relative flex items-center gap-1.5">
              {t.icon && <t.icon className="h-4 w-4" />}
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className={cn("rounded-full px-1.5 text-[10px] font-bold", active ? "bg-white/25" : "bg-brand/15 text-brand")}>{t.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------- Skeleton --------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-line/10", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-line/15 to-transparent" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/* --------------------------- Empty state -------------------------- */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl2 border border-dashed border-line/25 px-6 py-12 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Icon className="h-7 w-7" />
      </div>
      <h4 className="text-base font-semibold">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------ Avatar ---------------------------- */
export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={style} className={cn("shrink-0 rounded-full object-cover ring-2 ring-brand/25", className)} />;
  }
  return (
    <div style={style} className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand-gradient font-bold text-white ring-2 ring-brand/25", className)} aria-label={name}>
      {initials(name)}
    </div>
  );
}

/* --------------------------- Animated number ---------------------- */
export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const prev = React.useRef(0);
  React.useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals);
      },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, decimals]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {value.toFixed(decimals)}
    </span>
  );
}

/* ----------------------------- Stat card -------------------------- */
export function StatCard({
  icon: Icon,
  label,
  value,
  decimals,
  suffix,
  hint,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  hint?: string;
  tone?: "brand" | "success" | "warn" | "violet" | "danger";
}) {
  const tones = {
    brand: "bg-brand/15 text-brand",
    success: "bg-success/15 text-success",
    warn: "bg-warn/15 text-warn",
    violet: "bg-violet/15 text-violet",
    danger: "bg-danger/15 text-danger",
  };
  return (
    <Card hover className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold">
            <AnimatedNumber value={value} decimals={decimals} />
            {suffix && <span className="ml-1 text-base font-semibold text-muted">{suffix}</span>}
          </p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

/* --------------------------- Page header -------------------------- */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* --------------------------- Page transition ---------------------- */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

/* ----------------------------- Switch ----------------------------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-line/30")}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow", checked ? "right-0.5" : "left-0.5")} />
    </button>
  );
}

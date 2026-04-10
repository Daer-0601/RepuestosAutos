/** Fondo del área autenticada (admin / cajero / vendedor). El padre debe ser `relative min-h-dvh`. */
export function PanelAppBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-[#0a0f1a]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_110%_75%_at_0%_-20%,rgba(244,63,94,0.2),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_100%_105%,rgba(52,211,153,0.16),transparent_52%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_70%_30%,rgba(129,140,248,0.1),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_0%,rgba(15,23,42,0.4)_48%,transparent_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.4] bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:52px_52px]"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 70%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b border-neutral/60 bg-white/80 backdrop-blur-md h-16" />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-32 rounded bg-neutral/30" />
          <div className="h-8 w-64 rounded bg-neutral/30" />
          <div className="h-4 w-full rounded bg-neutral/30" />
          <div className="h-4 w-3/4 rounded bg-neutral/30" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-neutral/20" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Skeleton({
  rows = 4,
  rowClassName = "h-10",
  className = "",
}: {
  rows?: number;
  rowClassName?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`skeleton-shimmer rounded-md ${rowClassName}`} />
      ))}
    </div>
  );
}

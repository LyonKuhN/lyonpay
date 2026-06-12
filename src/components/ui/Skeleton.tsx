export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-800/50 dark:bg-zinc-800/50 ${className}`}
      {...props}
    />
  );
}

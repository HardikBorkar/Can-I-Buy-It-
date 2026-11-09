import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-xl bg-[#0f1d36] border border-[#1b3156]/50", className)}
      {...props}
    />
  )
}

export { Skeleton }

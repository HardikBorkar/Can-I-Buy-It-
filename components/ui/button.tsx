import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "bg-[#0070BA] text-white border-[#0070BA] hover:bg-[#005ea6] hover:text-white dark:bg-[#0070BA] dark:text-white dark:border-[#0070BA] dark:hover:bg-[#005ea6]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2.5 text-sm min-h-[40px]",
        xs: "px-2.5 py-1 text-xs min-h-[28px] rounded-md [&_svg:not([class*='size-'])]:size-3",
        sm: "px-3 py-1.5 text-xs min-h-[32px] rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        lg: "px-6 py-3 text-base min-h-[48px]",
        icon: "size-10 p-0",
        "icon-xs": "size-6 p-0 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 p-0 rounded-md",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

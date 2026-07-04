import { cn } from "@/lib/utils";

type Props = React.ComponentProps<"div">;

const Skeleton: React.FC<Props> = ({ className, ...props }) => (
  <div
    data-slot="skeleton"
    className={cn("animate-pulse rounded-md bg-muted", className)}
    {...props}
  />
);

export { Skeleton };

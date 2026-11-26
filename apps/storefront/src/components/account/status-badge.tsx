import { orderStatusLabels, type CustomOrderStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const styles: Record<CustomOrderStatus, string> = {
  RECEIVED: "bg-ip-cyan/20 text-ip-deep",
  MOCKUP_SENT: "bg-ip-sun/30 text-ip-ink",
  APPROVED: "bg-ip-teal/15 text-ip-teal",
  IN_PRODUCTION: "bg-ip-teal/15 text-ip-teal",
  READY: "bg-ip-teal text-white",
  DELIVERED: "bg-ip-deep text-white",
  CANCELLED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, className }: { status: CustomOrderStatus; className?: string }) {
  return (
    <span data-testid="order-status" className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", styles[status], className)}>
      {orderStatusLabels[status]}
    </span>
  );
}

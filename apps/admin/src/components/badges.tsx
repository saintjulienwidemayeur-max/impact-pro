import { Badge } from "@/components/ui/kit";
import { DOC_STATUS, ORDER_STATUS } from "@/lib/format";
import type { DocumentStatus, OrderStatus } from "@/lib/types";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function DocStatusBadge({ status, overdue }: { status: DocumentStatus; overdue?: boolean }) {
  const s = DOC_STATUS[status] ?? { label: status, tone: "gray" as const };
  return (
    <span className="inline-flex items-center gap-1">
      <Badge tone={s.tone}>{s.label}</Badge>
      {overdue && <Badge tone="red">En retard</Badge>}
    </span>
  );
}

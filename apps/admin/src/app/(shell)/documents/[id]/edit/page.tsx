"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { DocumentEditor } from "@/components/document-editor";
import { Skeleton } from "@/components/ui/kit";

export default function EditDocumentPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <DocumentEditor documentId={id} />
    </Suspense>
  );
}

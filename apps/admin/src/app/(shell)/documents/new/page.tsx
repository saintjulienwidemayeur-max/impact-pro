"use client";

import { Suspense } from "react";
import { DocumentEditor } from "@/components/document-editor";
import { Skeleton } from "@/components/ui/kit";

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <DocumentEditor />
    </Suspense>
  );
}

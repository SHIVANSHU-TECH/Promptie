"use client";

import { useParams } from "next/navigation";
import { TemplateForm } from "@/components/TemplateForm";

export default function TemplateEditorPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  return <TemplateForm key={id} templateId={id} />;
}

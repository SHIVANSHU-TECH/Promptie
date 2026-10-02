"use client";

import { useParams } from "next/navigation";
import { CompanyForm } from "@/components/CompanyForm";

export default function CompanyEditorPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return null;
  return <CompanyForm key={id} companyId={id} />;
}

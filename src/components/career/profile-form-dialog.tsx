"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { saveProfileBasics } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CareerProfileRow } from "@/lib/db";

export function ProfileFormDialog({
  profile,
  desiredRoles,
  desiredCompanies,
}: {
  profile: CareerProfileRow | null;
  desiredRoles: string[];
  desiredCompanies: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await saveProfileBasics({
      headline: String(form.get("headline") ?? ""),
      summary: String(form.get("summary") ?? ""),
      desiredRolesText: String(form.get("desiredRolesText") ?? ""),
      desiredCompaniesText: String(form.get("desiredCompaniesText") ?? ""),
      githubUsername: String(form.get("githubUsername") ?? ""),
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> 프로필 수정
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Career Profile">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pf-headline">헤드라인</Label>
            <Input
              id="pf-headline"
              name="headline"
              maxLength={80}
              defaultValue={profile?.headline ?? ""}
              placeholder="예: Software × AI"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-summary">소개</Label>
            <Textarea id="pf-summary" name="summary" rows={3} defaultValue={profile?.summary ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-roles">희망 직무 (쉼표 구분)</Label>
            <Input id="pf-roles" name="desiredRolesText" defaultValue={desiredRoles.join(", ")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-companies">희망 기업 (쉼표 구분)</Label>
            <Input id="pf-companies" name="desiredCompaniesText" defaultValue={desiredCompanies.join(", ")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-github">GitHub 아이디</Label>
            <Input id="pf-github" name="githubUsername" maxLength={60} defaultValue={profile?.githubUsername ?? ""} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              저장
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEvent } from "@/actions/events";
import { Button } from "@/components/ui/button";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      variant="ghost"
      size="iconSm"
      disabled={pending}
      aria-label="일정 삭제"
      onClick={() =>
        startTransition(async () => {
          await deleteEvent(eventId);
          router.refresh();
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}

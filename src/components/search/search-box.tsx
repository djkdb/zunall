"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="활동·문서 본문·메모·자소서에서 검색"
        aria-label="전체 검색"
        autoFocus
      />
      <Button type="submit">
        <Search className="h-4 w-4" />
        검색
      </Button>
    </form>
  );
}

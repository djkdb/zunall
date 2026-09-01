"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ACTIVITY_TYPES } from "@/lib/constants";

const STATUS_FILTERS = {
  all: "전체",
  ongoing: "진행 중",
  imminent: "마감 임박",
  interested: "관심",
  finished: "종료",
} as const;

export function ActivityFilters({ tags }: { tags: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");

  const update = React.useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
      router.replace(`/activities?${params.toString()}`);
    },
    [router, searchParams],
  );

  // 검색어 디바운스
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== query) update("q", query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, searchParams, update]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="활동명, 기관, 태그, 메모 검색…"
          className="pl-8"
          aria-label="활동 검색"
        />
      </div>
      <div className="flex gap-2">
        <Select
          value={searchParams.get("filter") ?? "all"}
          onChange={(e) => update("filter", e.target.value)}
          className="w-auto"
          aria-label="상태 필터"
        >
          {Object.entries(STATUS_FILTERS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={searchParams.get("type") ?? "all"}
          onChange={(e) => update("type", e.target.value)}
          className="w-auto"
          aria-label="종류 필터"
        >
          <option value="all">모든 종류</option>
          {Object.entries(ACTIVITY_TYPES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        {tags.length > 0 && (
          <Select
            value={searchParams.get("tag") ?? "all"}
            onChange={(e) => update("tag", e.target.value)}
            className="w-auto"
            aria-label="태그 필터"
          >
            <option value="all">모든 태그</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </Select>
        )}
      </div>
    </div>
  );
}

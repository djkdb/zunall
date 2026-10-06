/**
 * Photo frames for the interview panel, cut from pose sheets by
 * scripts/build-panel-photos.py (see assets/panel/frames.json).
 *
 * With a set for every seat the room is the photographed one (public/panel/room.webp);
 * otherwise, or with `?panel=svg`, it is the drawn room with SVG figures.
 */
import type { Seat } from "./panel";

export type PhotoState = "idle" | "think" | "talk" | "review";
export type PhotoSet = Record<PhotoState, number>;

/** Canvas size of every frame in px (bottom edge = desk line, head centred). */
export const PHOTO_BOX = { width: 300, height: 230 };

/** Number of frames per state for each seat that has photos. */
export const PANEL_PHOTOS: Partial<Record<Seat, PhotoSet>> = {
  left: { idle: 3, think: 3, talk: 4, review: 3 },
  center: { idle: 3, think: 3, talk: 4, review: 3 },
  right: { idle: 3, think: 3, talk: 4, review: 3 },
};

export function photoSrc(seat: Seat, state: PhotoState, n: number): string {
  return `/panel/${seat}/${state}-${n + 1}.webp`;
}

export function photosEnabled(): boolean {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("panel") === "svg") return false;
  return (["left", "center", "right"] as Seat[]).every((s) => PANEL_PHOTOS[s]);
}

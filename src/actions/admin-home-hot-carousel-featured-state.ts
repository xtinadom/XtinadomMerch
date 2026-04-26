/** Client + `useActionState` — must not live in a `"use server"` file (Next only allows async fn exports there). */
export type AdminSaveHomeHotCarouselFeaturedState = { ok: boolean; error: string | null };

export const adminSaveHomeHotCarouselFeaturedInitialState: AdminSaveHomeHotCarouselFeaturedState = {
  ok: false,
  error: null,
};

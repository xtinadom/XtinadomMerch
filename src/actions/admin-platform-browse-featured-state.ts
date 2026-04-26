/** Client + `useActionState` — must not live in a `"use server"` file. */
export type AdminSavePlatformBrowseFeaturedState = { ok: boolean; error: string | null };

export const adminSavePlatformBrowseFeaturedInitialState: AdminSavePlatformBrowseFeaturedState = {
  ok: false,
  error: null,
};

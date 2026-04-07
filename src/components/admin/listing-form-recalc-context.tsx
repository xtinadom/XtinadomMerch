"use client";

import { createContext, useContext } from "react";

export const ListingFormRecalcContext = createContext<(() => void) | null>(null);

export function useListingFormRecalc(): (() => void) | null {
  return useContext(ListingFormRecalcContext);
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

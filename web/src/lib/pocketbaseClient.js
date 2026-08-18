import PocketBase from "pocketbase";

export const POCKETBASE_URL = import.meta.env?.VITE_POCKETBASE_URL || "https://pocket.nings.top";

export const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCloudData, saveCloudChanges } from "./pocketbaseSync.js";
import { mergeCloudState } from "./stateModel.js";

const LOCAL_SYNC_STATUS = { kind: "local", label: "本地保存" };
const WAITING_SYNC_STATUS = { kind: "waiting", label: "等待同步" };
const AUTO_SYNC_DELAY_MS = 1800;
const CLOUD_COLLECTIONS = ["articles", "vocabulary_items", "daily_plans", "review_events", "notes", "user_settings"];

function toSyncStatus(result, pendingCount = 0) {
  if (result.status === "unavailable") return { kind: "unavailable", label: "同步服务未配置，本地保存中", pendingCount };
  if (result.status === "partial") return { kind: "partial", label: `${result.failedCollections.length} 个集合同步失败`, pendingCount };
  if (pendingCount) return { kind: "partial", label: `${pendingCount} 项等待同步`, pendingCount };
  return { kind: "ok", label: "刚刚已同步", pendingCount: 0 };
}

export function useCloudSync({ actions, notify, pb, state, storage, user }) {
  const [syncStatus, setSyncStatus] = useState(user ? WAITING_SYNC_STATUS : LOCAL_SYNC_STATUS);
  const stateRef = useRef(state);
  const userId = user?.id || "";
  const syncTimerRef = useRef(null);
  const isReadyRef = useRef(false);
  const inFlightRef = useRef(null);
  stateRef.current = state;

  const pushPendingChanges = useCallback(async () => {
    if (!userId) return { status: "unavailable", failedCollections: [], acknowledgedKeys: [] };
    await storage.flushPersistence();
    const pendingEntries = await storage.listPendingSyncEntries();
    if (!pendingEntries.length) return { status: "ok", saved: 0, failedCollections: [], unavailableCollections: [], acknowledgedKeys: [] };
    const result = await saveCloudChanges(pb, userId, stateRef.current, pendingEntries);
    await storage.acknowledgeSyncEntries(result.acknowledgedKeys || []);
    return result;
  }, [pb, storage, userId]);

  const performSync = useCallback(async ({ showSummary = false } = {}) => {
    if (!userId) return { status: "unavailable", failedCollections: [] };
    if (inFlightRef.current) return inFlightRef.current;

    const operation = (async () => {
      setSyncStatus({ kind: "syncing", label: "正在合并本地与云端数据…" });
      const cursors = await storage.readCloudSyncCursors(userId);
      const loaded = await loadCloudData(pb, userId, { cursors });
      if (loaded.status === "unavailable") {
        setSyncStatus(toSyncStatus(loaded));
        if (showSummary) notify("PocketBase 学习集合尚未配置，数据继续保存在本机");
        return loaded;
      }

      const merged = mergeCloudState(stateRef.current, loaded.data);
      await actions.replaceState(merged.state);
      stateRef.current = merged.state;
      await storage.writeCloudSyncCursors(userId, loaded.cursors);
      const saved = await pushPendingChanges();
      const remaining = await storage.listPendingSyncEntries();
      const finalResult = saved.status === "ok" && loaded.status !== "ok" ? loaded : saved;
      setSyncStatus(toSyncStatus(finalResult, remaining.length));
      if (showSummary) notify(`同步完成：云端合并 ${merged.summary.downloaded} 项，本地保留 ${merged.summary.retained} 项，冲突 ${merged.summary.conflicts} 项`);
      return finalResult;
    })();

    inFlightRef.current = operation;
    try {
      return await operation;
    } finally {
      inFlightRef.current = null;
    }
  }, [actions, notify, pb, pushPendingChanges, storage, userId]);

  useEffect(() => {
    if (!userId) {
      isReadyRef.current = false;
      setSyncStatus(LOCAL_SYNC_STATUS);
      return undefined;
    }
    let isCancelled = false;
    isReadyRef.current = false;
    performSync({ showSummary: true }).catch(() => {
      if (!isCancelled) setSyncStatus({ kind: "partial", label: "网络不可用，本地保存中" });
    }).finally(() => {
      if (!isCancelled) isReadyRef.current = true;
    });
    return () => { isCancelled = true; };
  }, [performSync, userId]);

  useEffect(() => {
    if (!userId || !isReadyRef.current) return undefined;
    window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(async () => {
      setSyncStatus({ kind: "syncing", label: "正在同步…" });
      try {
        const result = await pushPendingChanges();
        const remaining = await storage.listPendingSyncEntries();
        setSyncStatus(toSyncStatus(result, remaining.length));
      } catch {
        setSyncStatus({ kind: "partial", label: "网络不可用，本地保存中" });
      }
    }, AUTO_SYNC_DELAY_MS);
    return () => window.clearTimeout(syncTimerRef.current);
  }, [pushPendingChanges, state, storage, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const retrySync = () => {
      if (document.visibilityState === "visible" && navigator.onLine) performSync().catch(() => {});
    };
    window.addEventListener("online", retrySync);
    document.addEventListener("visibilitychange", retrySync);
    return () => {
      window.removeEventListener("online", retrySync);
      document.removeEventListener("visibilitychange", retrySync);
    };
  }, [performSync, userId]);

  useEffect(() => {
    if (!userId || typeof pb.collection !== "function") return undefined;
    let isCancelled = false;
    let unsubscribeAll = [];
    const subscribe = async () => {
      const subscriptions = await Promise.allSettled(CLOUD_COLLECTIONS.map((collection) => (
        pb.collection(collection).subscribe("*", () => {
          if (!isCancelled) performSync().catch(() => {});
        })
      )));
      unsubscribeAll = subscriptions
        .filter((result) => result.status === "fulfilled" && typeof result.value === "function")
        .map((result) => result.value);
      if (isCancelled) unsubscribeAll.forEach((unsubscribe) => unsubscribe());
    };
    subscribe().catch(() => {});
    return () => {
      isCancelled = true;
      unsubscribeAll.forEach((unsubscribe) => unsubscribe());
    };
  }, [pb, performSync, userId]);

  const syncNow = useCallback(async () => {
    try {
      await performSync({ showSummary: true });
    } catch {
      setSyncStatus({ kind: "partial", label: "网络不可用，本地保存中" });
      notify("同步失败，本地数据未受影响，可稍后重试");
    }
  }, [notify, performSync]);

  return { syncNow, syncStatus };
}

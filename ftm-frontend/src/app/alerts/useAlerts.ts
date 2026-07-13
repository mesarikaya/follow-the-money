"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertRuleDto,
  AlertsResponse,
  acknowledgeAlert,
  bulkDismissAlerts,
  fetchAlertRules,
  fetchAlerts,
  setAlertRuleEnabled,
} from "@/lib/api";

/** The alerts page reloads itself every minute, so a left-open tab is never stale. */
export const AUTO_REFRESH_SECONDS = 60;

/**
 * Owns everything the alerts page does: loading alerts and rules, the refresh countdown,
 * acknowledging one alert or dismissing them all, and toggling a rule on or off.
 */
export function useAlerts() {
  const [alertsResponse, setAlertsResponse] = useState<AlertsResponse | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRuleDto[] | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [isBulkDismissing, setIsBulkDismissing] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);

  const loadAlerts = useCallback(async () => {
    try {
      setAlertsResponse(await fetchAlerts());
      setLoadError(null);
    } catch (error) {
      setLoadError(String(error));
    }
  }, []);

  const loadRules = useCallback(async () => {
    try {
      setAlertRules(await fetchAlertRules());
    } catch {
      /* the rules panel is optional — an alert list without it is still useful */
    }
  }, []);

  const refresh = useCallback(async () => {
    setCountdown(AUTO_REFRESH_SECONDS);
    await Promise.all([loadAlerts(), loadRules()]);
  }, [loadAlerts, loadRules]);

  useEffect(() => {
    loadAlerts();
    loadRules();
  }, [loadAlerts, loadRules]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(secondsLeft => {
        if (secondsLeft > 1) return secondsLeft - 1;
        loadAlerts();
        return AUTO_REFRESH_SECONDS;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loadAlerts]);

  const toggleRule = async (ruleId: string, isEnabled: boolean) => {
    setTogglingRuleId(ruleId);
    try {
      const updated = await setAlertRuleEnabled(ruleId, !isEnabled);
      setAlertRules(rules =>
        rules ? rules.map(rule => (rule.ruleId === ruleId ? updated : rule)) : rules,
      );
    } catch {
      /* a failed toggle simply leaves the switch where it was */
    } finally {
      setTogglingRuleId(null);
    }
  };

  const dismissAll = async () => {
    setIsBulkDismissing(true);
    setAcknowledgeError(null);
    try {
      await bulkDismissAlerts();
      await loadAlerts();
    } catch (error) {
      setAcknowledgeError(String(error));
    } finally {
      setIsBulkDismissing(false);
    }
  };

  const acknowledge = async (alertId: number) => {
    setAcknowledgingId(alertId);
    setAcknowledgeError(null);
    try {
      await acknowledgeAlert(alertId);
      await loadAlerts();
    } catch (error) {
      setAcknowledgeError(String(error));
    } finally {
      setAcknowledgingId(null);
    }
  };

  const clearErrors = () => {
    setAcknowledgeError(null);
    setLoadError(null);
  };

  return {
    alertsResponse,
    alertRules,
    acknowledgingId,
    isBulkDismissing,
    togglingRuleId,
    loadError,
    acknowledgeError,
    countdown,
    refresh,
    toggleRule,
    dismissAll,
    acknowledge,
    clearErrors,
  };
}

export type UseAlertsResult = ReturnType<typeof useAlerts>;

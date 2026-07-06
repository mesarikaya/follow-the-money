package com.ftm.app.signals.domain;

public enum MacroRegime {
  STAGFLATION,
  RISK_OFF_FLIGHT,
  RISK_ON_GROWTH,
  RISK_ON_DEFENSIVE;

  /** The regime name for a stored ordinal value, or "UNKNOWN" if the ordinal is out of range. */
  public static String nameForOrdinal(int ordinal) {
    MacroRegime[] values = values();
    return ordinal >= 0 && ordinal < values.length ? values[ordinal].name() : "UNKNOWN";
  }
}

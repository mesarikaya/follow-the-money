package com.ftm.app.themes.confluence;

import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.transition.PhaseTransitionSignal;

/**
 * What the confluence score is computed from. The entry action and the phase transition are enums,
 * not strings: the factors switch over them exhaustively, so introducing a signal without scoring it
 * becomes a compile error rather than a silent zero.
 */
public record ConfluenceInput(
    EntryAction entryAction,
    String riskLevel,
    String momentumAlignment,
    PhaseTransitionSignal phaseTransitionSignal) {}

-- V17: Add sell-side rotation event types: ENTERING_WEAKENING and ENTERING_LAGGING.
-- These complete the four-quadrant RRG cycle: buy-side (ENTERING_IMPROVING, ENTERING_LEADING)
-- and sell-side (ENTERING_WEAKENING, ENTERING_LAGGING).

ALTER TABLE rotation_events
    DROP CONSTRAINT IF EXISTS rotation_events_event_type_check;

ALTER TABLE rotation_events
    ADD CONSTRAINT rotation_events_event_type_check
    CHECK (event_type IN (
        'ENTERING_IMPROVING',
        'ENTERING_LEADING',
        'ENTERING_WEAKENING',
        'ENTERING_LAGGING',
        'FLOW_SURGE',
        'COMPOSITE_BREAKOUT'
    ));

-- V64: Add COMPOSITE_BREAKDOWN to rotation_events event_type constraint.
-- The Java RotationEventType enum has had COMPOSITE_BREAKDOWN since it was added in EP-008,
-- but the DB check constraint was never updated to include it, causing a constraint violation
-- every time RotationEventDetector.detectCompositeBreakdown() fires.

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
        'COMPOSITE_BREAKOUT',
        'COMPOSITE_BREAKDOWN'
    ));

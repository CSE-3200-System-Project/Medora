# Dashboard record coverage — R1-07

The reference patient dashboard repurposes the gauge and summary-card layout as
**Today's record coverage** and **Today's measurement groups**. It does not render the
former composite Health Score, clinical-style AI Health Insights, or reminder-log-derived
medication-adherence chart. The dashboard endpoint now returns only measurements,
record coverage, appointments, and device-sync status; score/advice fields and the
reminder-derived adherence calculation have been removed from that endpoint.

The API's `record_coverage` field reports four displayed groups: steps, sleep hours,
heart rate and blood pressure. A group is recorded if a finite numeric stored reading
has timezone-aware `recorded_at` in the current UTC day, no later than the response
snapshot. Blood pressure requires both component types; this is not proof they were
measured together. Duplicate readings do not increase the count. Other metric types
do not change the fixed denominator. Zero and negative finite values count as stored
values; no clinical plausibility or quality check is inferred.

`coverage_percent = round(100 * recorded_groups / 4)`.

The UI exposes the numerator/denominator, group membership, formula, UTC day window
and snapshot. UTC window boundaries are displayed as readable dates; the snapshot is
formatted in Bangladesh time. This is not a rolling 24-hour window or local-calendar day. An empty
successful response means 0/4. API failure or an older API lacking this field means
**Unavailable**, never a fabricated 0%. Presence does not establish a newly measured
or clinically accurate reading. Recording all four groups is not a recommendation,
goal or prerequisite for being healthy.

English and Bengali labels distinguish recorded/missing data without health grades,
diagnosis, treatment suggestions or AI attribution. No additional database query or
migration is needed; the summary uses the existing bounded daily metric read.

The testable claim is correct counting of stored groups, not clinical benefit. Tests
cover zero/missing, duplicate rows, both blood-pressure components, UTC boundaries,
future timestamps, non-finite values and absence of clinical thresholds. Authentic
revised dashboard screenshots and Figure 4 replacement remain required before claiming
that the paper figure matches the interface.

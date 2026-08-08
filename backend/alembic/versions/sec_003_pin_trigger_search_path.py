"""Pin the slot-change trigger's search_path.

Supabase's database linter flags `public.emit_slot_change_event` with
`function_search_path_mutable`. The function is SECURITY INVOKER and already qualifies
`public.slot_change_events`, so this is not the classic privilege-escalation case, but it
fires on every insert, update, and delete against `appointments` and it still resolves
`now()`, the casts, and the ON CONFLICT arbiter through whatever search_path the caller
happens to have. Pinning it removes that dependency entirely.

An earlier audit of this database missed it because it only inspected SECURITY DEFINER
functions. Mutable search_path matters for invoker functions too.

Revision ID: sec_003
Revises: enum_sync_001
"""

from alembic import op

revision = "sec_003"
down_revision = "enum_sync_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER FUNCTION public.emit_slot_change_event() SET search_path = pg_catalog, public")


def downgrade() -> None:
    op.execute("ALTER FUNCTION public.emit_slot_change_event() RESET search_path")

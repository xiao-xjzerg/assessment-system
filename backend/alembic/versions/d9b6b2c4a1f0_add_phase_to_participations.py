"""add_phase_to_participations

Revision ID: d9b6b2c4a1f0
Revises: b5e82d3f1a49
Create Date: 2026-05-11 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9b6b2c4a1f0"
down_revision: Union[str, Sequence[str], None] = "b5e82d3f1a49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "participations",
        sa.Column(
            "phase",
            sa.String(length=20),
            nullable=False,
            server_default="交付",
            comment="项目阶段：售前/交付",
        ),
    )

    bind = op.get_bind()
    bind.execute(sa.text("""
        UPDATE participations
        SET phase = CASE
            WHEN (
                SELECT COALESCE(p.delivery_progress, 0) - COALESCE(p.used_delivery_progress, 0)
                FROM projects p
                WHERE p.id = participations.project_id
            ) > 0 THEN '交付'
            WHEN (
                SELECT COALESCE(p.presale_progress, 0) - COALESCE(p.used_presale_progress, 0)
                FROM projects p
                WHERE p.id = participations.project_id
            ) > 0 THEN '售前'
            ELSE '交付'
        END
    """))
    bind.execute(sa.text("""
        INSERT INTO participations (
            cycle_id, project_id, employee_id, employee_name, department,
            phase, participation_coeff, status, created_at, updated_at
        )
        SELECT
            pa.cycle_id, pa.project_id, pa.employee_id, pa.employee_name, pa.department,
            '售前', pa.participation_coeff, pa.status, pa.created_at, pa.updated_at
        FROM participations pa
        JOIN projects p ON p.id = pa.project_id
        WHERE pa.phase = '交付'
          AND COALESCE(p.delivery_progress, 0) - COALESCE(p.used_delivery_progress, 0) > 0
          AND COALESCE(p.presale_progress, 0) - COALESCE(p.used_presale_progress, 0) > 0
    """))


def downgrade() -> None:
    with op.batch_alter_table("participations") as batch_op:
        batch_op.drop_column("phase")

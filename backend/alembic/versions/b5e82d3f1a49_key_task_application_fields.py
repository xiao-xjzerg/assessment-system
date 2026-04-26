"""key task application fields

Revision ID: b5e82d3f1a49
Revises: a7f2e1b6d0c4
Create Date: 2026-04-24 10:00:00.000000

重点任务由"管理员为员工录单分"改为"基层管理人员自行申请"：
- 每员工每周期可提交多条申请（任务名称 + 完成情况 + 申请分值 1~10）
- 同员工全部申请 score 合计不得超过 10（业务层强校验）
- key_task_scores 新增 task_name / completion 字段
- 按用户要求清空历史数据（老行只有聚合 score，没有任务描述）
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b5e82d3f1a49'
down_revision: Union[str, Sequence[str], None] = 'a7f2e1b6d0c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 先清空老数据（按用户要求：不迁移、全部重新申请）
    op.execute("DELETE FROM key_task_scores")

    # SQLite ALTER ADD COLUMN 要求 NOT NULL 列必须有 default；
    # 清表后追加列，server_default='' 让已存在的（即 0 行）数据兼容，
    # ORM 层仍要求显式传值
    with op.batch_alter_table('key_task_scores') as batch_op:
        batch_op.add_column(
            sa.Column('task_name', sa.String(length=200), nullable=False, server_default='')
        )
        batch_op.add_column(
            sa.Column('completion', sa.String(length=1000), nullable=False, server_default='')
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('key_task_scores') as batch_op:
        batch_op.drop_column('completion')
        batch_op.drop_column('task_name')

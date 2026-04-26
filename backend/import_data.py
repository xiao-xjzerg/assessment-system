"""导入模拟数据脚本：将 templates 中的 Excel 文件导入数据库
Excel 中的枚举值与系统定义不一致，导入时按映射表转换。
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import async_session_factory, engine
from app.models.cycle import Cycle
from app.models.employee import Employee
from app.models.project import Project
from app.services.excel_service import parse_employee_excel, parse_project_excel
from app.services.employee_service import import_employees, reimport_employees
from app.services.project_service import import_projects, reimport_projects

from sqlalchemy import select


TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

# ============================================================
# 映射表：Excel 值 → 系统合法值
# ============================================================

# 部门：系统仅支持 实施交付部 / 产品研发部
DEPT_MAP = {
    "实施交付部": "实施交付部",
    "智能解决方案部": "实施交付部",
    "销售支持部": "实施交付部",
    "技术研发部": "产品研发部",
    "产品中心": "产品研发部",
}

# 角色：员工表仅支持 管理员 / 普通员工 / 领导
# "项目经理" 不再是员工表角色，由项目一览表的 pm_id 动态派生
ROLE_MAP = {
    "项目经理": "普通员工",
    "管理人员": "管理员",
    "业务人员": "普通员工",
    "技术人员": "普通员工",
    "销售人员": "普通员工",
}

# 考核类型：系统仅支持 基层管理人员 / 公共人员 / 业务人员 / 产品研发人员
ASSESS_TYPE_MAP = {
    "业务人员": "业务人员",
    "技术人员": "产品研发人员",
    "销售人员": "业务人员",
}

# 项目类型：系统仅支持 集成 / 综合 / 自研 / 运营
PROJECT_TYPE_MAP = {
    "集成": "集成",
    "咨询": "综合",
    "总包": "集成",
    "服务": "运营",
    "定制": "自研",
    "开发": "自研",
}

# 实施方式：系统仅支持 服务 / 产品+服务
IMPL_METHOD_MAP = {
    "服务": "服务",
    "分包": "服务",
    "总包": "服务",
    "自研": "产品+服务",
}


def map_employee_rows(rows: list[dict]) -> list[dict]:
    """将员工数据的枚举值映射为系统合法值"""
    for row in rows:
        if row.get("department"):
            row["department"] = DEPT_MAP.get(row["department"], row["department"])
        if row.get("role"):
            row["role"] = ROLE_MAP.get(row["role"], row["role"])
        if row.get("assess_type"):
            row["assess_type"] = ASSESS_TYPE_MAP.get(row["assess_type"], row["assess_type"])
    return rows


def map_project_rows(rows: list[dict]) -> list[dict]:
    """将项目数据的枚举值映射为系统合法值"""
    for row in rows:
        if row.get("project_type"):
            row["project_type"] = PROJECT_TYPE_MAP.get(row["project_type"], row["project_type"])
        if row.get("impl_method"):
            row["impl_method"] = IMPL_METHOD_MAP.get(row["impl_method"], row["impl_method"])
        if row.get("department"):
            row["department"] = DEPT_MAP.get(row["department"], row["department"])
    return rows


async def get_or_create_active_cycle(session):
    """获取活跃周期，如果没有则创建一个"""
    result = await session.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        print("没有找到活跃的考核周期，正在创建「2026年Q2」...")
        cycle = Cycle(name="2026年Q2", phase=1, is_active=True, is_archived=False)
        session.add(cycle)
        await session.flush()
        print(f"  已创建考核周期: {cycle.name} (ID={cycle.id})")
    else:
        print(f"使用已有的活跃周期: {cycle.name} (ID={cycle.id}, 阶段={cycle.phase})")
    return cycle


async def import_employee_data(session, cycle_id: int):
    """导入员工模拟数据"""
    filepath = os.path.join(TEMPLATES_DIR, "employee_simulated_01.xlsx")
    if not os.path.exists(filepath):
        print(f"  文件不存在: {filepath}")
        return

    print(f"\n--- 导入员工数据 ---")
    print(f"  文件: {filepath}")

    with open(filepath, "rb") as f:
        rows = parse_employee_excel(f)

    print(f"  解析到 {len(rows)} 条员工记录")
    if not rows:
        print("  没有数据，跳过")
        return

    # 映射枚举值
    rows = map_employee_rows(rows)
    print("  已完成枚举值映射")

    # 检查是否已有员工数据
    count_result = await session.execute(
        select(Employee).where(Employee.cycle_id == cycle_id).limit(1)
    )
    existing = count_result.scalar_one_or_none()

    if existing:
        print("  当前周期已有员工数据，使用全量更新模式...")
        result = await reimport_employees(session, cycle_id, rows)
    else:
        result = await import_employees(session, cycle_id, rows)

    if result["errors"]:
        print(f"  导入失败！错误信息:")
        for err in result["errors"]:
            print(f"    - {err}")
    else:
        print(f"  成功导入 {result['success_count']} 名员工")


async def import_project_data(session, cycle_id: int):
    """导入项目模拟数据"""
    filepath = os.path.join(TEMPLATES_DIR, "project_simulated_01.xlsx")
    if not os.path.exists(filepath):
        print(f"  文件不存在: {filepath}")
        return

    print(f"\n--- 导入项目数据 ---")
    print(f"  文件: {filepath}")

    with open(filepath, "rb") as f:
        rows = parse_project_excel(f)

    print(f"  解析到 {len(rows)} 条项目记录")
    if not rows:
        print("  没有数据，跳过")
        return

    # 映射枚举值
    rows = map_project_rows(rows)
    print("  已完成枚举值映射")

    # 检查是否已有项目数据
    count_result = await session.execute(
        select(Project).where(Project.cycle_id == cycle_id).limit(1)
    )
    existing = count_result.scalar_one_or_none()

    if existing:
        print("  当前周期已有项目数据，使用全量更新模式...")
        result = await reimport_projects(session, cycle_id, rows)
    else:
        result = await import_projects(session, cycle_id, rows)

    if result["errors"]:
        print(f"  导入失败！错误信息:")
        for err in result["errors"]:
            print(f"    - {err}")
    else:
        print(f"  成功导入 {result['success_count']} 个项目")


async def main():
    print("=" * 50)
    print("  模拟数据导入工具")
    print("=" * 50)

    async with async_session_factory() as session:
        try:
            cycle = await get_or_create_active_cycle(session)
            await import_employee_data(session, cycle.id)
            await import_project_data(session, cycle.id)
            await session.commit()
            print("\n" + "=" * 50)
            print("  所有数据导入完成！")
            print("=" * 50)
        except Exception as e:
            await session.rollback()
            print(f"\n导入过程出错: {e}")
            raise
        finally:
            await session.close()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

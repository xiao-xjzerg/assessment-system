/**
 * 项目参与度页 —— 项目经理 / 管理员可见。
 *
 * 功能：
 *   - 项目经理视图：左侧项目列表 → 右侧参与度填报表（添加员工、设置系数、保存/提交）
 *   - 管理员视图：额外展示填报概览统计 Tab + 查看/修改全部项目参与度
 *   - 参与度校验：同项目内同部门员工参与系数合计为 1（±0.01 浮点容差）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  InputNumber,
  Select,
  Tag,
  Popconfirm,
  Tabs,
  Alert,
  Empty,
  Spin,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SaveOutlined,
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { participationApi } from '@/services/api/participation';
import { employeeApi } from '@/services/api/employee';
import type { Participation, ParticipationSummary, Project, Employee } from '@/types';
import { ALL_DEPARTMENTS } from '@/utils/constants';
import { formatCoeff } from '@/utils/format';
import { useUserStore } from '@/stores/userStore';

/** 本地编辑行 */
interface EditRow {
  key: string;
  id?: number; // 已持久化记录的 ID
  employee_id: number;
  employee_name: string;
  department: string;
  participation_coeff: number;
}

// ==================== 概览统计（管理员 Tab） ====================

function SummaryTab() {
  const { message } = AntdApp.useApp();
  const [data, setData] = useState<ParticipationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await participationApi.summary();
      setData(res);
    } catch {
      message.error('加载填报概览失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<ParticipationSummary> = [
    { title: '项目令号', dataIndex: 'project_code', width: 140 },
    { title: '项目名称', dataIndex: 'project_name', ellipsis: true },
    { title: '主承部门', dataIndex: 'department', width: 120 },
    { title: '项目经理', dataIndex: 'pm_name', width: 100 },
    {
      title: '填报状态',
      dataIndex: 'filled',
      width: 100,
      render: (filled: boolean) =>
        filled ? (
          <Tag icon={<CheckCircleOutlined />} color="success">已填报</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">未填报</Tag>
        ),
      filters: [
        { text: '已填报', value: true },
        { text: '未填报', value: false },
      ],
      onFilter: (value, record) => record.filled === value,
    },
  ];

  return (
    <Table<ParticipationSummary>
      rowKey="project_id"
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      size="middle"
    />
  );
}

// ==================== 填报视图（PM + 管理员共用） ====================

function FillTab() {
  const { message, modal } = AntdApp.useApp();
  const isAdmin = useUserStore((s) => s.isAdmin());

  // 项目列表
  const [projects, setProjects] = useState<Project[]>([]);
  const [projLoading, setProjLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // 参与度记录
  const [rows, setRows] = useState<EditRow[]>([]);
  const [partLoading, setPartLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 员工选择器
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    setProjLoading(true);
    try {
      const res = await participationApi.listMyProjects();
      setProjects(res);
      if (res.length > 0 && selectedProjectId === null) {
        setSelectedProjectId(res[0].id);
      }
    } catch {
      message.error('加载项目列表失败');
    } finally {
      setProjLoading(false);
    }
  }, [message, selectedProjectId]);

  // 加载参与度
  const loadParticipation = useCallback(async (projectId: number) => {
    setPartLoading(true);
    try {
      const res = await participationApi.listByProject(projectId);
      setRows(
        res.map((p: Participation) => ({
          key: `p-${p.id}`,
          id: p.id,
          employee_id: p.employee_id,
          employee_name: p.employee_name,
          department: p.department,
          participation_coeff: Number(p.participation_coeff),
        })),
      );
    } catch {
      message.error('加载参与度记录失败');
    } finally {
      setPartLoading(false);
    }
  }, [message]);

  // 加载员工列表（用于添加参与人选择器）
  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const res = await employeeApi.fetchAll();
      setEmployees(res);
    } catch {
      // 静默
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadEmployees();
  }, [loadProjects, loadEmployees]);

  useEffect(() => {
    if (selectedProjectId !== null) {
      loadParticipation(selectedProjectId);
    }
  }, [selectedProjectId, loadParticipation]);

  // 当前项目
  const currentProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  // 已选员工 ID 集合
  const selectedEmpIds = useMemo(() => new Set(rows.map((r) => r.employee_id)), [rows]);

  // 可选员工列表（排除已选）
  const availableEmployees = useMemo(
    () => employees.filter((e) => !selectedEmpIds.has(e.id)),
    [employees, selectedEmpIds],
  );

  // 同部门系数合计校验
  const deptSumMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.department] = (map[r.department] || 0) + r.participation_coeff;
    }
    return map;
  }, [rows]);

  const deptWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const [dept, sum] of Object.entries(deptSumMap)) {
      if (rows.some((r) => r.department === dept) && Math.abs(sum - 1) > 0.01) {
        warnings.push(`${dept} 参与系数合计为 ${sum.toFixed(4)}，应为 1.0`);
      }
    }
    return warnings;
  }, [deptSumMap, rows]);

  // 添加员工
  const handleAddEmployee = (empId: number) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${empId}`,
        employee_id: emp.id,
        employee_name: emp.name,
        department: emp.department,
        participation_coeff: 0,
      },
    ]);
  };

  // 修改系数
  const handleCoeffChange = (key: string, val: number | null) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, participation_coeff: val ?? 0 } : r)),
    );
  };

  // 删除行
  const handleRemove = async (row: EditRow) => {
    if (row.id) {
      try {
        await participationApi.remove(row.id);
        message.success('已删除');
      } catch {
        message.error('删除失败');
        return;
      }
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key));
  };

  // 保存 / 提交
  const handleSave = async (submit: boolean) => {
    if (!selectedProjectId) return;
    if (rows.length === 0) {
      message.warning('请先添加参与人');
      return;
    }
    if (submit && deptWarnings.length > 0) {
      modal.warning({
        title: '参与系数校验未通过',
        content: (
          <ul style={{ paddingLeft: 20 }}>
            {deptWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ),
      });
      return;
    }

    setSaving(true);
    try {
      await participationApi.save(
        {
          project_id: selectedProjectId,
          items: rows.map((r) => ({
            employee_id: r.employee_id,
            employee_name: r.employee_name,
            department: r.department,
            participation_coeff: r.participation_coeff,
          })),
        },
        submit,
      );
      message.success(submit ? '参与度已提交' : '参与度已保存');
      loadParticipation(selectedProjectId);
    } catch {
      message.error(submit ? '提交失败' : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<EditRow> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100 },
    { title: '部门', dataIndex: 'department', width: 120 },
    {
      title: '参与系数',
      dataIndex: 'participation_coeff',
      width: 150,
      render: (_: number, record: EditRow) => (
        <InputNumber
          value={record.participation_coeff}
          min={0}
          max={1}
          step={0.01}
          precision={4}
          style={{ width: 120 }}
          onChange={(val) => handleCoeffChange(record.key, val)}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: EditRow) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleRemove(record)}>
          <Button type="link" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  // 项目选择下拉选项
  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        label: `${p.project_code} - ${p.project_name}`,
        value: p.id,
      })),
    [projects],
  );

  return (
    <Spin spinning={projLoading}>
      {projects.length === 0 && !projLoading ? (
        <Empty description="暂无负责的项目" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 项目选择 */}
          <Space wrap>
            <span>选择项目：</span>
            <Select
              value={selectedProjectId}
              options={projectOptions}
              onChange={(val) => setSelectedProjectId(val)}
              style={{ width: 400 }}
              showSearch
              optionFilterProp="label"
              placeholder="选择项目"
              loading={projLoading}
            />
            {currentProject && (
              <>
                <Tag color="blue">{currentProject.project_type}</Tag>
                <Tag>{currentProject.department}</Tag>
                <Tag>PM: {currentProject.pm_name || '-'}</Tag>
              </>
            )}
          </Space>

          {/* 校验警告 */}
          {deptWarnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message="参与系数校验"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {deptWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              }
            />
          )}

          {/* 添加员工 + 操作按钮 */}
          <Space wrap>
            <Select
              placeholder="添加参与人"
              showSearch
              optionFilterProp="label"
              style={{ width: 260 }}
              loading={empLoading}
              value={null as unknown as number}
              onChange={handleAddEmployee}
              options={availableEmployees.map((e) => ({
                label: `${e.name}（${e.department}）`,
                value: e.id,
              }))}
            />
            <Button
              icon={<SaveOutlined />}
              onClick={() => handleSave(false)}
              loading={saving}
            >
              保存
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSave(true)}
              loading={saving}
            >
              提交
            </Button>
          </Space>

          {/* 部门系数汇总 */}
          {Object.keys(deptSumMap).length > 0 && (
            <Space>
              {Object.entries(deptSumMap).map(([dept, sum]) => (
                <Tag
                  key={dept}
                  color={Math.abs(sum - 1) <= 0.01 ? 'success' : 'warning'}
                >
                  {dept}: {formatCoeff(sum)}
                </Tag>
              ))}
            </Space>
          )}

          {/* 参与度表格 */}
          <Table<EditRow>
            rowKey="key"
            columns={columns}
            dataSource={rows}
            loading={partLoading}
            pagination={false}
            size="middle"
          />
        </div>
      )}
    </Spin>
  );
}

// ==================== 管理员全量视图 ====================

function AdminAllTab() {
  const { message } = AntdApp.useApp();
  const [data, setData] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterProject, setFilterProject] = useState<number | undefined>();
  const [filterDept, setFilterDept] = useState<string | undefined>();

  // 项目列表（用于筛选器）
  const [projects, setProjects] = useState<Project[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await participationApi.listAll({
        project_id: filterProject,
        department: filterDept,
      });
      setData(res);
    } catch {
      message.error('加载参与度数据失败');
    } finally {
      setLoading(false);
    }
  }, [message, filterProject, filterDept]);

  const loadProjects = useCallback(async () => {
    try {
      const res = await participationApi.listMyProjects();
      setProjects(res);
    } catch {
      // 静默
    }
  }, []);

  useEffect(() => {
    load();
    loadProjects();
  }, [load, loadProjects]);

  const columns: ColumnsType<Participation> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100 },
    { title: '部门', dataIndex: 'department', width: 120 },
    {
      title: '参与系数',
      dataIndex: 'participation_coeff',
      width: 120,
      render: (v: number | string) => formatCoeff(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string | null) => {
        if (!s) return <Tag>草稿</Tag>;
        return s === '已提交' ? <Tag color="success">已提交</Tag> : <Tag>{s}</Tag>;
      },
    },
  ];

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="按项目筛选"
          allowClear
          style={{ width: 300 }}
          showSearch
          optionFilterProp="label"
          value={filterProject}
          onChange={(val) => setFilterProject(val)}
          options={projects.map((p) => ({
            label: `${p.project_code} - ${p.project_name}`,
            value: p.id,
          }))}
        />
        <Select
          placeholder="按部门筛选"
          allowClear
          style={{ width: 160 }}
          value={filterDept}
          onChange={(val) => setFilterDept(val)}
          options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
        />
      </Space>
      <Table<Participation>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="middle"
      />
    </div>
  );
}

// ==================== 主组件 ====================

export default function ParticipationPage() {
  const isAdmin = useUserStore((s) => s.isAdmin());
  const isLeader = useUserStore((s) => s.isLeader());
  // 领导与管理员等权：可查看所有项目的参与度、全量管理与概览统计
  const isPrivileged = isAdmin || isLeader;

  const items = useMemo(() => {
    const tabs = [
      {
        key: 'fill',
        label: '参与度填报',
        children: <FillTab />,
      },
    ];
    if (isPrivileged) {
      tabs.push(
        {
          key: 'summary',
          label: '填报概览',
          children: <SummaryTab />,
        },
        {
          key: 'all',
          label: '全量管理',
          children: <AdminAllTab />,
        },
      );
    }
    return tabs;
  }, [isPrivileged]);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="项目参与度"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
      >
        <Tabs items={items} />
      </Card>
    </div>
  );
}

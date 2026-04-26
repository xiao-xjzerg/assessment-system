/**
 * 考核参数设置页 —— 仅管理员可见。
 *
 * 5 个 Tab 对应 5 组参数：
 *   1. 部门人均目标值
 *   2. 专项目标值
 *   3. 项目类型系数
 *   4. 员工指标系数
 *   5. 签约概率设置
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  InputNumber,
  Form,
  Select,
  Input,
  Popconfirm,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SaveOutlined,
  UndoOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { parameterApi } from '@/services/api/parameter';
import type {
  DeptTarget,
  DeptTargetItem,
  SpecialTarget,
  ProjectTypeCoeff,
  ProjectTypeCoeffItem,
  IndicatorCoeff,
  IndicatorCoeffItem,
  Project,
  SigningProbabilityItem,
} from '@/types';
import { ALL_DEPARTMENTS } from '@/utils/constants';
import { formatCoeff, formatPercent } from '@/utils/format';

// ==================== Tab 1: 部门人均目标值 ====================

function DeptTargetsTab() {
  const { message } = AntdApp.useApp();
  const [data, setData] = useState<DeptTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 本地编辑状态
  const [editMap, setEditMap] = useState<
    Record<string, { profit_target: number; income_target: number }>
  >({});
  // 新增行
  const [newRows, setNewRows] = useState<DeptTargetItem[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await parameterApi.listDeptTargets();
      setData(list);
      // 初始化编辑 map
      const map: typeof editMap = {};
      for (const item of list) {
        const key = `${item.department}|${item.group_name || ''}`;
        map[key] = {
          profit_target: Number(item.profit_target),
          income_target: Number(item.income_target),
        };
      }
      setEditMap(map);
      setNewRows([]);
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateField = (
    key: string,
    field: 'profit_target' | 'income_target',
    value: number | null,
  ) => {
    setEditMap((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value ?? 0 },
    }));
  };

  // 本地暂存删除：把该行从 data 和 editMap 中移除，下次"保存"全量覆盖时即生效
  const stageRemoveExisting = (row: DeptTarget) => {
    const key = `${row.department}|${row.group_name || ''}`;
    setData((prev) => prev.filter((r) => r.id !== row.id));
    setEditMap((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addRow = () => {
    setNewRows((prev) => [
      ...prev,
      { department: '', group_name: '', profit_target: 0, income_target: 0 },
    ]);
  };

  const removeNewRow = (idx: number) => {
    setNewRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateNewRow = (
    idx: number,
    field: keyof DeptTargetItem,
    value: unknown,
  ) => {
    setNewRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  const onSave = async () => {
    // 合并已有 + 新增
    const items: DeptTargetItem[] = [];
    for (const item of data) {
      const key = `${item.department}|${item.group_name || ''}`;
      const edit = editMap[key];
      items.push({
        department: item.department,
        group_name: item.group_name || undefined,
        profit_target: edit?.profit_target ?? Number(item.profit_target),
        income_target: edit?.income_target ?? Number(item.income_target),
      });
    }
    for (const row of newRows) {
      if (!row.department) {
        message.warning('新增行请选择部门');
        return;
      }
      items.push({
        department: row.department,
        group_name: row.group_name || undefined,
        profit_target: Number(row.profit_target),
        income_target: Number(row.income_target),
      });
    }
    setSaving(true);
    try {
      await parameterApi.saveDeptTargets(items);
      message.success('部门目标值保存成功');
      fetchData();
    } catch {
      // 拦截器已处理
    } finally {
      setSaving(false);
    }
  };

  const existingColumns: ColumnsType<DeptTarget> = [
    { title: '部门', dataIndex: 'department', width: 150 },
    {
      title: '组/中心',
      dataIndex: 'group_name',
      width: 150,
      render: (v) => v || '(部门整体)',
    },
    {
      title: '人均利润目标值（万元）',
      dataIndex: 'profit_target',
      width: 200,
      render: (_v, row) => {
        const key = `${row.department}|${row.group_name || ''}`;
        return (
          <InputNumber
            value={editMap[key]?.profit_target}
            min={0}
            step={0.01}
            style={{ width: 150 }}
            onChange={(val) => updateField(key, 'profit_target', val)}
          />
        );
      },
    },
    {
      title: '人均自研收入目标值（万元）',
      dataIndex: 'income_target',
      width: 220,
      render: (_v, row) => {
        const key = `${row.department}|${row.group_name || ''}`;
        return (
          <InputNumber
            value={editMap[key]?.income_target}
            min={0}
            step={0.01}
            style={{ width: 150 }}
            onChange={(val) => updateField(key, 'income_target', val)}
          />
        );
      },
    },
    {
      title: '操作',
      width: 90,
      render: (_v, row) => (
        <Popconfirm
          title="确认删除该目标值？"
          description={
            <div style={{ maxWidth: 280 }}>
              风险提示：
              <br />
              1. 删除后，原本匹配到本行的员工在经济指标计算中，会回退到"部门整体"兜底；若无兜底则为 0。
              <br />
              2. 经济指标总分将被拉低甚至清零，最终成绩/排名随之变化。
              <br />
              3. 删除需点击上方"保存"按钮才真正生效；未保存前刷新页面可恢复。
            </div>
          }
          okText="确认删除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          onConfirm={() => stageRemoveExisting(row)}
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} onClick={addRow}>
          新增行
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={onSave}
        >
          保存
        </Button>
      </Space>
      <Table<DeptTarget>
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={existingColumns}
        pagination={false}
        size="middle"
        scroll={{ x: 820 }}
      />
      {newRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>新增行：</div>
          <Table
            rowKey={(_r, idx) => `new-${idx}`}
            dataSource={newRows}
            pagination={false}
            size="middle"
            columns={[
              {
                title: '部门',
                width: 150,
                render: (_v, _r, idx) => (
                  <Select
                    value={newRows[idx].department || undefined}
                    placeholder="选择部门"
                    style={{ width: 140 }}
                    options={ALL_DEPARTMENTS.map((d) => ({
                      label: d,
                      value: d,
                    }))}
                    onChange={(v) => updateNewRow(idx, 'department', v)}
                  />
                ),
              },
              {
                title: '组/中心',
                width: 150,
                render: (_v, _r, idx) => (
                  <Input
                    value={newRows[idx].group_name as string}
                    placeholder="可选"
                    style={{ width: 140 }}
                    onChange={(e) =>
                      updateNewRow(idx, 'group_name', e.target.value)
                    }
                  />
                ),
              },
              {
                title: '人均利润目标值',
                width: 200,
                render: (_v, _r, idx) => (
                  <InputNumber
                    value={Number(newRows[idx].profit_target)}
                    min={0}
                    step={0.01}
                    style={{ width: 150 }}
                    onChange={(v) => updateNewRow(idx, 'profit_target', v ?? 0)}
                  />
                ),
              },
              {
                title: '人均自研收入目标值',
                width: 220,
                render: (_v, _r, idx) => (
                  <InputNumber
                    value={Number(newRows[idx].income_target)}
                    min={0}
                    step={0.01}
                    style={{ width: 150 }}
                    onChange={(v) => updateNewRow(idx, 'income_target', v ?? 0)}
                  />
                ),
              },
              {
                title: '',
                width: 60,
                render: (_v, _r, idx) => (
                  <Button
                    size="small"
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeNewRow(idx)}
                  />
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ==================== Tab 2: 专项目标值 ====================

function SpecialTargetsTab() {
  const { message } = AntdApp.useApp();
  const [data, setData] = useState<SpecialTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{
    product_contract_target: number;
    tech_innovation_target: number;
  }>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await parameterApi.listSpecialTargets();
      setData(list);
      // 从列表中提取两个目标值
      const productItem = list.find(
        (i) => i.target_name === '产品合同目标值',
      );
      const techItem = list.find(
        (i) => i.target_name === '科技创新目标值',
      );
      form.setFieldsValue({
        product_contract_target: productItem
          ? Number(productItem.target_value)
          : 0,
        tech_innovation_target: techItem
          ? Number(techItem.target_value)
          : 0,
      });
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await parameterApi.saveSpecialTargets({
        product_contract_target: values.product_contract_target,
        tech_innovation_target: values.tech_innovation_target,
      });
      message.success('专项目标值保存成功');
      fetchData();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 500 }}
        disabled={loading}
      >
        <Form.Item
          label="产品合同目标值（万元）"
          name="product_contract_target"
          rules={[{ required: true, message: '请输入产品合同目标值' }]}
        >
          <InputNumber
            min={0}
            step={0.01}
            style={{ width: '100%' }}
            placeholder="请输入"
          />
        </Form.Item>
        <Form.Item
          label="科技创新目标值（万元）"
          name="tech_innovation_target"
          rules={[{ required: true, message: '请输入科技创新目标值' }]}
        >
          <InputNumber
            min={0}
            step={0.01}
            style={{ width: '100%' }}
            placeholder="请输入"
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={onSave}
          >
            保存
          </Button>
        </Form.Item>
      </Form>
      {data.length > 0 && (
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          当前已保存 {data.length} 项专项目标值
        </div>
      )}
    </div>
  );
}

// ==================== Tab 3: 项目类型系数 ====================

interface EditableRow {
  key: string;
  id?: number;
  project_type: string;
  coefficient: number;
  isNew?: boolean;
}

function ProjectTypeCoeffsTab() {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await parameterApi.listProjectTypeCoeffs();
      setRows(
        list.map((item) => ({
          key: `exist-${item.id}`,
          id: item.id,
          project_type: item.project_type,
          coefficient: Number(item.coefficient),
        })),
      );
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateRow = (key: string, field: 'project_type' | 'coefficient', value: unknown) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value as never } : r)),
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        project_type: '',
        coefficient: 1,
        isNew: true,
      },
    ]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const onSave = async () => {
    const names = rows.map((r) => r.project_type.trim());
    if (names.some((n) => !n)) {
      message.warning('项目类型名称不能为空');
      return;
    }
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) {
      message.warning(`项目类型名称重复：${dup}`);
      return;
    }
    const items: ProjectTypeCoeffItem[] = rows.map((r) => ({
      project_type: r.project_type.trim(),
      coefficient: Number(r.coefficient) || 0,
    }));
    setSaving(true);
    try {
      await parameterApi.saveProjectTypeCoeffs(items);
      message.success('项目类型系数保存成功');
      fetchData();
    } catch {
      // 拦截器已处理
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    setLoading(true);
    try {
      await parameterApi.resetProjectTypeCoeffs();
      message.success('已重置为默认值');
      fetchData();
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<EditableRow> = [
    {
      title: '项目类型',
      dataIndex: 'project_type',
      width: 200,
      render: (_v, row) => (
        <Input
          value={row.project_type}
          placeholder="如：运营/运维"
          style={{ width: 180 }}
          onChange={(e) => updateRow(row.key, 'project_type', e.target.value)}
        />
      ),
    },
    {
      title: '系数',
      dataIndex: 'coefficient',
      width: 200,
      render: (_v, row) => (
        <InputNumber
          value={row.coefficient}
          min={0}
          max={10}
          step={0.1}
          style={{ width: 150 }}
          onChange={(val) => updateRow(row.key, 'coefficient', val ?? 0)}
        />
      ),
    },
    {
      title: '当前值',
      key: 'display',
      width: 120,
      render: (_v, row) => formatCoeff(row.coefficient),
    },
    {
      title: '操作',
      width: 90,
      render: (_v, row) => (
        <Popconfirm
          title="确认删除该项目类型？"
          description={
            <div style={{ maxWidth: 280 }}>
              风险提示：
              <br />
              1. 删除后，已有该项目类型的项目，工作量系数计算时会按默认 1.0 处理，并在导入时列入警告。
              <br />
              2. 删除需点击上方"保存"按钮才真正生效；未保存前刷新页面可恢复。
            </div>
          }
          okText="确认删除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
          onConfirm={() => removeRow(row.key)}
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} onClick={addRow}>
          新增行
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={onSave}
        >
          保存
        </Button>
        <Popconfirm
          title="确认重置为默认值？"
          description="将恢复系统预设的 4 项（运营/运维 0.7、集成 1.0、基金课题/咨询 1.5、自研/AI 2.0），当前自定义的项目类型将被清除。"
          okText="重置"
          cancelText="取消"
          onConfirm={onReset}
        >
          <Button icon={<UndoOutlined />}>重置默认</Button>
        </Popconfirm>
      </Space>
      <Table<EditableRow>
        rowKey="key"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        size="middle"
        scroll={{ x: 620 }}
      />
    </div>
  );
}

// ==================== Tab 4: 员工指标系数 ====================

function IndicatorCoeffsTab() {
  const { message } = AntdApp.useApp();
  const [data, setData] = useState<IndicatorCoeff[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMap, setEditMap] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await parameterApi.listIndicatorCoeffs();
      setData(list);
      const map: Record<string, number> = {};
      for (const item of list) {
        map[item.grade] = Number(item.coefficient);
      }
      setEditMap(map);
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSave = async () => {
    const items: IndicatorCoeffItem[] = data.map((item) => ({
      grade: item.grade,
      coefficient: editMap[item.grade] ?? Number(item.coefficient),
    }));
    setSaving(true);
    try {
      await parameterApi.saveIndicatorCoeffs(items);
      message.success('员工指标系数保存成功');
      fetchData();
    } catch {
      // 拦截器已处理
    } finally {
      setSaving(false);
    }
  };

  const onReset = async () => {
    setLoading(true);
    try {
      await parameterApi.resetIndicatorCoeffs();
      message.success('已重置为默认值');
      fetchData();
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<IndicatorCoeff> = [
    { title: '岗级', dataIndex: 'grade', width: 100 },
    {
      title: '指标系数',
      dataIndex: 'coefficient',
      width: 200,
      render: (_v, row) => (
        <InputNumber
          value={editMap[row.grade]}
          min={0}
          max={10}
          step={0.01}
          style={{ width: 150 }}
          onChange={(val) =>
            setEditMap((prev) => ({
              ...prev,
              [row.grade]: val ?? 0,
            }))
          }
        />
      ),
    },
    {
      title: '当前值',
      key: 'display',
      width: 120,
      render: (_v, row) => formatCoeff(editMap[row.grade]),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={onSave}
        >
          保存
        </Button>
        <Popconfirm
          title="确认重置为默认值？"
          description="将恢复系统预设的员工指标系数（T1=0.8 ~ T9=1.5 等）。"
          okText="重置"
          cancelText="取消"
          onConfirm={onReset}
        >
          <Button icon={<UndoOutlined />}>重置默认</Button>
        </Popconfirm>
      </Space>
      <Table<IndicatorCoeff>
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        pagination={false}
        size="middle"
        scroll={{ x: 420 }}
      />
    </div>
  );
}

// ==================== Tab 5: 签约概率设置 ====================

function SigningProbabilityTab() {
  const { message } = AntdApp.useApp();
  const [data, setData] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spMap, setSpMap] = useState<Record<number, number>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await parameterApi.listSigningProbabilities();
      setData(list);
      const map: Record<number, number> = {};
      for (const p of list) {
        map[p.id] = Number(p.signing_probability);
      }
      setSpMap(map);
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSave = async () => {
    const items: SigningProbabilityItem[] = data.map((p) => ({
      project_id: p.id,
      signing_probability: spMap[p.id] ?? Number(p.signing_probability),
    }));
    setSaving(true);
    try {
      await parameterApi.saveSigningProbabilities(items);
      message.success('签约概率保存成功（已自动重算经济规模系数）');
      fetchData();
    } catch {
      // 拦截器已处理
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<Project> = [
    { title: '项目令号', dataIndex: 'project_code', width: 130 },
    { title: '项目名称', dataIndex: 'project_name', width: 200, ellipsis: true },
    { title: '项目类型', dataIndex: 'project_type', width: 100 },
    { title: '主承部门', dataIndex: 'department', width: 120 },
    {
      title: '合同金额（万元）',
      dataIndex: 'contract_amount',
      width: 140,
      render: (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : '-'),
    },
    {
      title: '签约概率',
      dataIndex: 'signing_probability',
      width: 160,
      render: (_v, row) => (
        <InputNumber
          value={spMap[row.id]}
          min={0.5}
          max={1}
          step={0.05}
          style={{ width: 120 }}
          onChange={(val) =>
            setSpMap((prev) => ({ ...prev, [row.id]: val ?? 0.5 }))
          }
          formatter={(val) =>
            val !== undefined ? `${(Number(val) * 100).toFixed(0)}%` : ''
          }
          parser={(val) =>
            val ? (Number(val.replace('%', '')) / 100) as unknown as number : 0.5
          }
        />
      ),
    },
    {
      title: '当前概率',
      key: 'display',
      width: 100,
      render: (_v, row) => formatPercent(spMap[row.id], 0),
    },
  ];

  return (
    <div>
      {data.length === 0 && !loading ? (
        <div style={{ color: '#999', padding: '40px 0', textAlign: 'center' }}>
          当前无未签约项目，无需设置签约概率。
        </div>
      ) : (
        <>
          <Space style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={onSave}
            >
              保存
            </Button>
            <span style={{ color: '#999', fontSize: 12 }}>
              签约概率范围 50%~100%，保存后将自动重算经济规模系数
            </span>
          </Space>
          <Table<Project>
            rowKey="id"
            loading={loading}
            dataSource={data}
            columns={columns}
            pagination={false}
            size="middle"
            scroll={{ x: 850 }}
          />
        </>
      )}
    </div>
  );
}

// ==================== 主页面 ====================

export default function ParameterPage() {
  const tabItems = [
    {
      key: 'dept-targets',
      label: '部门人均目标值',
      children: <DeptTargetsTab />,
    },
    {
      key: 'special-targets',
      label: '专项目标值',
      children: <SpecialTargetsTab />,
    },
    {
      key: 'project-type-coeffs',
      label: '项目类型系数',
      children: <ProjectTypeCoeffsTab />,
    },
    {
      key: 'indicator-coeffs',
      label: '员工指标系数',
      children: <IndicatorCoeffsTab />,
    },
    {
      key: 'signing-probability',
      label: '签约概率',
      children: <SigningProbabilityTab />,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="考核参数设置"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
      >
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}

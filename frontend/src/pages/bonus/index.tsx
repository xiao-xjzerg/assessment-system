/**
 * 加减分 / 重点任务分数页 —— 管理员可见。
 *
 * 功能：
 *   - 加减分记录 CRUD（新增/删除，单员工总和±10限制）
 *   - 重点任务分数录入（仅基层管理人员，0~10分，支持批量保存）
 *   - 导出加减分数据 Excel
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tabs,
  Form,
  Modal,
  InputNumber,
  Popconfirm,
  Tag,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { bonusApi } from '@/services/api/bonus';
import { employeeApi } from '@/services/api/employee';
import type { BonusRecord, KeyTaskScore, Employee } from '@/types';
import { ALL_DEPARTMENTS, ALL_ASSESS_TYPES, ASSESS_TYPE } from '@/utils/constants';
import { formatNumber, downloadBlob, extractFilename } from '@/utils/format';

export default function BonusPage() {
  const { message, modal } = AntdApp.useApp();

  // ==================== 加减分记录 ====================
  const [records, setRecords] = useState<BonusRecord[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordFilter, setRecordFilter] = useState<{
    department?: string;
    assess_type?: string;
  }>({});

  const loadRecords = useCallback(async () => {
    setRecordLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (recordFilter.department) params.department = recordFilter.department;
      if (recordFilter.assess_type) params.assess_type = recordFilter.assess_type;
      const res = await bonusApi.listRecords(params);
      setRecords(res);
    } catch {
      message.error('加载加减分记录失败');
    } finally {
      setRecordLoading(false);
    }
  }, [message, recordFilter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 新增加减分 Modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [addLoading, setAddLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const openAdd = async () => {
    addForm.resetFields();
    setAddOpen(true);
    if (employees.length === 0) {
      try {
        const res = await employeeApi.list({ page_size: 500 });
        setEmployees(res.items);
      } catch {
        message.error('加载员工列表失败');
      }
    }
  };

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields();
      setAddLoading(true);
      await bonusApi.createRecord({
        employee_id: values.employee_id,
        description: values.description,
        value: values.value,
      });
      message.success('新增成功');
      setAddOpen(false);
      loadRecords();
    } catch {
      message.error('新增失败');
    } finally {
      setAddLoading(false);
    }
  };

  // 删除
  const handleDelete = async (id: number) => {
    try {
      await bonusApi.removeRecord(id);
      message.success('删除成功');
      loadRecords();
    } catch {
      message.error('删除失败');
    }
  };

  // 导出
  const handleExport = async () => {
    try {
      const res = await bonusApi.exportExcel();
      const filename = extractFilename(res.headers?.['content-disposition'], '加减分数据.xlsx');
      downloadBlob(res.data, filename);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // 加减分表列
  const recordColumns: ColumnsType<BonusRecord> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100, fixed: 'left' },
    { title: '部门', dataIndex: 'department', width: 110 },
    { title: '考核类型', dataIndex: 'assess_type', width: 120 },
    { title: '说明', dataIndex: 'description', width: 250, ellipsis: true },
    {
      title: '分值',
      dataIndex: 'value',
      width: 80,
      align: 'right',
      render: (v: number | string) => {
        const num = Number(v);
        return (
          <Tag color={num > 0 ? 'success' : num < 0 ? 'error' : 'default'}>
            {num > 0 ? '+' : ''}{formatNumber(num)}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      width: 70,
      fixed: 'right',
      render: (_: unknown, record: BonusRecord) => (
        <Popconfirm title="确定删除此记录？" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ==================== 重点任务分数 ====================
  const [keyTasks, setKeyTasks] = useState<KeyTaskScore[]>([]);
  const [keyTaskLoading, setKeyTaskLoading] = useState(false);
  const [keyTaskEdits, setKeyTaskEdits] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);

  const loadKeyTasks = useCallback(async () => {
    setKeyTaskLoading(true);
    try {
      const res = await bonusApi.listKeyTasks();
      setKeyTasks(res);
      // 初始化编辑状态
      const edits: Record<number, number> = {};
      res.forEach((t) => {
        edits[t.employee_id] = Number(t.score);
      });
      setKeyTaskEdits(edits);
    } catch {
      message.error('加载重点任务分数失败');
    } finally {
      setKeyTaskLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadKeyTasks();
  }, [loadKeyTasks]);

  const handleKeyTaskChange = (employeeId: number, value: number | null) => {
    setKeyTaskEdits((prev) => ({ ...prev, [employeeId]: value ?? 0 }));
  };

  const handleBatchSave = async () => {
    const items = Object.entries(keyTaskEdits).map(([empId, score]) => ({
      employee_id: Number(empId),
      score,
    }));
    if (items.length === 0) {
      message.warning('没有可保存的数据');
      return;
    }
    setSaving(true);
    try {
      await bonusApi.batchSaveKeyTasks(items);
      message.success('批量保存成功');
      loadKeyTasks();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 重点任务表列
  const keyTaskColumns: ColumnsType<KeyTaskScore> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100 },
    {
      title: '重点任务分数（0~10）',
      dataIndex: 'score',
      width: 200,
      render: (_: unknown, record: KeyTaskScore) => (
        <InputNumber
          min={0}
          max={10}
          step={0.5}
          precision={1}
          value={keyTaskEdits[record.employee_id] ?? Number(record.score)}
          onChange={(v) => handleKeyTaskChange(record.employee_id, v)}
          style={{ width: 120 }}
        />
      ),
    },
    {
      title: '当前值',
      dataIndex: 'score',
      width: 80,
      align: 'right',
      render: (v: number | string) => formatNumber(Number(v)),
    },
  ];

  // ==================== 渲染 ====================
  return (
    <div style={{ padding: 24 }}>
      <Card
        title="加减分 / 重点任务"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出 Excel
          </Button>
        }
      >
        <Tabs
          defaultActiveKey="bonus"
          items={[
            {
              key: 'bonus',
              label: '加减分记录',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Select
                      placeholder="部门"
                      allowClear
                      style={{ width: 140 }}
                      value={recordFilter.department}
                      onChange={(v) => setRecordFilter((f) => ({ ...f, department: v }))}
                      options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
                    />
                    <Select
                      placeholder="考核类型"
                      allowClear
                      style={{ width: 150 }}
                      value={recordFilter.assess_type}
                      onChange={(v) => setRecordFilter((f) => ({ ...f, assess_type: v }))}
                      options={ALL_ASSESS_TYPES.map((t) => ({ label: t, value: t }))}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadRecords}>
                      查询
                    </Button>
                    <Button icon={<PlusOutlined />} onClick={openAdd}>
                      新增加减分
                    </Button>
                  </Space>
                  <Table
                    rowKey="id"
                    columns={recordColumns}
                    dataSource={records}
                    loading={recordLoading}
                    scroll={{ x: 800 }}
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                  />
                </>
              ),
            },
            {
              key: 'keyTask',
              label: '重点任务分数（基层管理人员）',
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      onClick={handleBatchSave}
                    >
                      批量保存
                    </Button>
                    <span style={{ color: 'var(--neu-text-secondary, #888)', fontSize: 13 }}>
                      仅基层管理人员可录入，分值范围 0~10
                    </span>
                  </Space>
                  <Table
                    rowKey="employee_id"
                    columns={keyTaskColumns}
                    dataSource={keyTasks}
                    loading={keyTaskLoading}
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* 新增加减分 Modal */}
      <Modal
        title="新增加减分"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={handleAddSubmit}
        confirmLoading={addLoading}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            label="员���"
            name="employee_id"
            rules={[{ required: true, message: '请选择员工' }]}
          >
            <Select
              showSearch
              placeholder="搜索并选择员工"
              optionFilterProp="label"
              options={employees.map((e) => ({
                label: `${e.name}（${e.department} - ${e.assess_type}）`,
                value: e.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="加减分说明"
            name="description"
            rules={[{ required: true, message: '请输入说明' }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item
            label="分值（正数为加分，负数为减分，单人总和限±10）"
            name="value"
            rules={[
              { required: true, message: '请输入分值' },
              { type: 'number', min: -10, max: 10, message: '分值范围 -10 ~ +10' },
            ]}
          >
            <InputNumber min={-10} max={10} step={0.5} precision={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

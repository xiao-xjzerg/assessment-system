/**
 * 积分统计页 —— 管理员可见。
 *
 * 功能：
 *   - 触发全量积分计算
 *   - 积分明细查询（按员工/项目/阶段/部门筛选）+ 管理员编辑
 *   - 积分汇总查询（按员工/部门/考核类型筛选）
 *   - Excel 导出
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Tag,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalculatorOutlined,
  DownloadOutlined,
  EditOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { scoreApi } from '@/services/api/score';
import type { ScoreDetail, ScoreDetailUpdate, ScoreSummary } from '@/types';
import {
  SCORE_PHASES,
  ALL_DEPARTMENTS,
  ALL_ASSESS_TYPES,
} from '@/utils/constants';
import { formatNumber, formatCoeff, downloadBlob, extractFilename } from '@/utils/format';

export default function ScorePage() {
  const { message, modal } = AntdApp.useApp();

  // ==================== 积分明细 ====================
  const [details, setDetails] = useState<ScoreDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFilter, setDetailFilter] = useState<{
    employee_name?: string;
    project_name?: string;
    phase?: string;
    department?: string;
  }>({});

  const loadDetails = useCallback(async () => {
    setDetailLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (detailFilter.employee_name) params.employee_name = detailFilter.employee_name;
      if (detailFilter.project_name) params.project_name = detailFilter.project_name;
      if (detailFilter.phase) params.phase = detailFilter.phase;
      if (detailFilter.department) params.department = detailFilter.department;
      const res = await scoreApi.listDetails(params);
      setDetails(res);
    } catch {
      message.error('加载积分明细失败');
    } finally {
      setDetailLoading(false);
    }
  }, [message, detailFilter]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // ==================== 积分汇总 ====================
  const [summaries, setSummaries] = useState<ScoreSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<{
    employee_name?: string;
    department?: string;
    assess_type?: string;
  }>({});

  const loadSummaries = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (summaryFilter.employee_name) params.employee_name = summaryFilter.employee_name;
      if (summaryFilter.department) params.department = summaryFilter.department;
      if (summaryFilter.assess_type) params.assess_type = summaryFilter.assess_type;
      const res = await scoreApi.listSummary(params);
      setSummaries(res);
    } catch {
      message.error('加载积分汇总失败');
    } finally {
      setSummaryLoading(false);
    }
  }, [message, summaryFilter]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // ==================== 触发计算 ====================
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = () => {
    modal.confirm({
      title: '确认触发积分计算',
      content: '将重新计算当前周期所有员工的积分明细和汇总，是否继续？',
      okText: '确认计算',
      onOk: async () => {
        setCalculating(true);
        try {
          await scoreApi.calculate();
          message.success('积分计算完成');
          loadDetails();
          loadSummaries();
        } catch {
          message.error('积分计算失败');
        } finally {
          setCalculating(false);
        }
      },
    });
  };

  // ==================== 导出 Excel ====================
  const handleExport = async () => {
    try {
      const res = await scoreApi.exportExcel();
      const filename = extractFilename(
        res.headers?.['content-disposition'],
        '积分统计.xlsx',
      );
      downloadBlob(res.data, filename);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // ==================== 编辑明细 Modal ====================
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<ScoreDetail | null>(null);
  const [editConfirmLoading, setEditConfirmLoading] = useState(false);
  const [editForm] = Form.useForm();

  // 预填策略：Modal 使用 destroyOnClose，Form 每次打开时重新挂载并读取 initialValues。
  const openEdit = (record: ScoreDetail) => {
    setEditingDetail(record);
    setEditModalOpen(true);
  };

  const editInitialValues = useMemo(() => {
    if (!editingDetail) return undefined;
    return {
      progress_coeff: Number(editingDetail.progress_coeff),
      workload_coeff: Number(editingDetail.workload_coeff),
      work_description: editingDetail.work_description || '',
      remark: editingDetail.remark || '',
    };
  }, [editingDetail]);

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditConfirmLoading(true);
      const body: ScoreDetailUpdate = {
        progress_coeff: values.progress_coeff,
        workload_coeff: values.workload_coeff,
        work_description: values.work_description || null,
        remark: values.remark || null,
      };
      await scoreApi.updateDetail(editingDetail!.id, body);
      message.success('修改成功');
      setEditModalOpen(false);
      loadDetails();
    } catch {
      message.error('修改失败');
    } finally {
      setEditConfirmLoading(false);
    }
  };

  // ==================== 明细表列 ====================
  const detailColumns: ColumnsType<ScoreDetail> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100, fixed: 'left' },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      width: 180,
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: '阶段',
      dataIndex: 'phase',
      width: 80,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          '售前': 'blue',
          '交付': 'green',
          '公共': 'orange',
          '转型': 'purple',
        };
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
      },
    },
    {
      title: '基础分值',
      dataIndex: 'base_score',
      width: 90,
      align: 'right',
      render: (v: number | string) => formatNumber(Number(v)),
    },
    {
      title: '进度系数',
      dataIndex: 'progress_coeff',
      width: 90,
      align: 'right',
      render: (v: number | string) => formatCoeff(Number(v)),
    },
    {
      title: '工作量系数',
      dataIndex: 'workload_coeff',
      width: 100,
      align: 'right',
      render: (v: number | string) => formatCoeff(Number(v)),
    },
    {
      title: '参与系数',
      dataIndex: 'participation_coeff',
      width: 90,
      align: 'right',
      render: (v: number | string) => formatCoeff(Number(v)),
    },
    {
      title: '积分',
      dataIndex: 'score',
      width: 90,
      align: 'right',
      render: (v: number | string) => formatNumber(Number(v)),
    },
    {
      title: '参与人',
      dataIndex: 'participant_name',
      width: 100,
      render: (v: string | null) => v || '-',
    },
    {
      title: '完成工作',
      dataIndex: 'work_description',
      width: 150,
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 120,
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: '操作',
      width: 70,
      fixed: 'right',
      render: (_: unknown, record: ScoreDetail) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  // ==================== 汇总表列 ====================
  const summaryColumns: ColumnsType<ScoreSummary> = [
    { title: '员工姓名', dataIndex: 'employee_name', width: 100, fixed: 'left' },
    { title: '部门', dataIndex: 'department', width: 120 },
    { title: '考核类型', dataIndex: 'assess_type', width: 120 },
    {
      title: '项目积分',
      dataIndex: 'project_score_total',
      width: 100,
      align: 'right',
      render: (v: number | string) => formatNumber(Number(v)),
    },
    {
      title: '公共积分',
      dataIndex: 'public_score_total',
      width: 100,
      align: 'right',
      render: (v: number | string) => formatNumber(Number(v)),
    },
    {
      title: '转型积分',
      dataIndex: 'transform_score_total',
      width: 100,
      align: 'right',
      render: (v: number | string) => formatNumber(Number(v)),
    },
    {
      title: '总积分',
      dataIndex: 'total_score',
      width: 100,
      align: 'right',
      render: (v: number | string) => (
        <span style={{ fontWeight: 600 }}>{formatNumber(Number(v))}</span>
      ),
    },
    {
      title: '归一化得分',
      dataIndex: 'normalized_score',
      width: 110,
      align: 'right',
      render: (v: number | string) => (
        <Tag color="geekblue">{formatNumber(Number(v))}</Tag>
      ),
    },
  ];

  // ==================== 渲染 ====================
  return (
    <div style={{ padding: 24 }}>
      <Card
        title="积分统计"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              loading={calculating}
              onClick={handleCalculate}
            >
              触发计算
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Excel
            </Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="details"
          items={[
            {
              key: 'details',
              label: '积分明细',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Input
                      placeholder="员工姓名"
                      allowClear
                      prefix={<SearchOutlined />}
                      style={{ width: 160 }}
                      value={detailFilter.employee_name}
                      onChange={(e) =>
                        setDetailFilter((f) => ({ ...f, employee_name: e.target.value }))
                      }
                      onPressEnter={loadDetails}
                    />
                    <Input
                      placeholder="项目名称"
                      allowClear
                      prefix={<SearchOutlined />}
                      style={{ width: 180 }}
                      value={detailFilter.project_name}
                      onChange={(e) =>
                        setDetailFilter((f) => ({ ...f, project_name: e.target.value }))
                      }
                      onPressEnter={loadDetails}
                    />
                    <Select
                      placeholder="阶段"
                      allowClear
                      style={{ width: 120 }}
                      value={detailFilter.phase}
                      onChange={(v) => setDetailFilter((f) => ({ ...f, phase: v }))}
                      options={SCORE_PHASES.map((p) => ({ label: p, value: p }))}
                    />
                    <Select
                      placeholder="部门"
                      allowClear
                      style={{ width: 140 }}
                      value={detailFilter.department}
                      onChange={(v) => setDetailFilter((f) => ({ ...f, department: v }))}
                      options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadDetails}>
                      查询
                    </Button>
                  </Space>
                  <Table
                    rowKey="id"
                    columns={detailColumns}
                    dataSource={details}
                    loading={detailLoading}
                    scroll={{ x: 1400 }}
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                  />
                </>
              ),
            },
            {
              key: 'summary',
              label: '积分汇总',
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Input
                      placeholder="员工姓名"
                      allowClear
                      prefix={<SearchOutlined />}
                      style={{ width: 160 }}
                      value={summaryFilter.employee_name}
                      onChange={(e) =>
                        setSummaryFilter((f) => ({ ...f, employee_name: e.target.value }))
                      }
                      onPressEnter={loadSummaries}
                    />
                    <Select
                      placeholder="部门"
                      allowClear
                      style={{ width: 140 }}
                      value={summaryFilter.department}
                      onChange={(v) => setSummaryFilter((f) => ({ ...f, department: v }))}
                      options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
                    />
                    <Select
                      placeholder="考核类型"
                      allowClear
                      style={{ width: 150 }}
                      value={summaryFilter.assess_type}
                      onChange={(v) => setSummaryFilter((f) => ({ ...f, assess_type: v }))}
                      options={ALL_ASSESS_TYPES.map((t) => ({ label: t, value: t }))}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={loadSummaries}>
                      查询
                    </Button>
                  </Space>
                  <Table
                    rowKey="id"
                    columns={summaryColumns}
                    dataSource={summaries}
                    loading={summaryLoading}
                    scroll={{ x: 900 }}
                    size="middle"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑明细 Modal */}
      <Modal
        title="编辑积分明细"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSubmit}
        confirmLoading={editConfirmLoading}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" preserve={false} initialValues={editInitialValues}>
          <Form.Item
            label="进度系数"
            name="progress_coeff"
            rules={[{ required: true, message: '请输入进度系数' }]}
          >
            <InputNumber min={0} max={2} step={0.01} precision={4} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="工作量系数"
            name="workload_coeff"
            rules={[{ required: true, message: '请输入工作量系数' }]}
          >
            <InputNumber min={0} step={0.01} precision={4} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="完成工作描述" name="work_description">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

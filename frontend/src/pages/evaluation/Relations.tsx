/**
 * 互评关系管理页 —— 管理员可见。
 *
 * 功能：
 *   - 自动生成互评关系
 *   - 查看互评关系列表（按被评人/评价人类型/部门筛选）
 *   - 编辑评价人（替换）
 *   - 导出互评关系 Excel
 *   - 评价进度统计卡片
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Tag,
  Progress,
  Row,
  Col,
  Statistic,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ThunderboltOutlined,
  DownloadOutlined,
  EditOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { evaluationApi } from '@/services/api/evaluation';
import { employeeApi } from '@/services/api/employee';
import type { EvalRelation, EvalProgress, Employee } from '@/types';
import { ALL_DEPARTMENTS } from '@/utils/constants';
import { downloadBlob, extractFilename } from '@/utils/format';

const EVALUATOR_TYPES = ['同事', '上级领导', '部门领导', '基层管理互评', '部门员工'];

export default function RelationsPage() {
  const { message, modal } = AntdApp.useApp();

  // 数据
  const [relations, setRelations] = useState<EvalRelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<EvalProgress | null>(null);

  // 筛选
  const [filter, setFilter] = useState<{
    evaluatee_name?: string;
    evaluator_type?: string;
    department?: string;
  }>({});

  const loadRelations = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (filter.evaluatee_name) params.evaluatee_name = filter.evaluatee_name;
      if (filter.evaluator_type) params.evaluator_type = filter.evaluator_type;
      if (filter.department) params.department = filter.department;
      const res = await evaluationApi.listRelations(params);
      setRelations(res);
    } catch {
      message.error('加载互评关系失败');
    } finally {
      setLoading(false);
    }
  }, [message, filter]);

  const loadProgress = useCallback(async () => {
    try {
      const res = await evaluationApi.progress();
      setProgress(res);
    } catch {
      // 静默
    }
  }, []);

  useEffect(() => {
    loadRelations();
    loadProgress();
  }, [loadRelations, loadProgress]);

  // 生成互评关系
  const [generating, setGenerating] = useState(false);
  const handleGenerate = () => {
    modal.confirm({
      title: '确认生成互评关系',
      content: '将根据当前周期员工信息自动匹配互评关系，已有关系会被重新生成。是否继续？',
      okText: '确认生成',
      onOk: async () => {
        setGenerating(true);
        try {
          const res = await evaluationApi.generateRelations();
          message.success(`互评关系生成完成，共创建 ${res.created} 条记录`);
          loadRelations();
          loadProgress();
        } catch {
          message.error('生成互评关系失败');
        } finally {
          setGenerating(false);
        }
      },
    });
  };

  // 导出
  const handleExport = async () => {
    try {
      const res = await evaluationApi.exportRelations();
      const filename = extractFilename(res.headers?.['content-disposition'], '互评关系.xlsx');
      downloadBlob(res.data, filename);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  // 编辑评价人 Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<EvalRelation | null>(null);
  const [editForm] = Form.useForm();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const openEdit = async (record: EvalRelation) => {
    setEditingRelation(record);
    editForm.setFieldsValue({
      evaluator_id: record.evaluator_id,
    });
    setEditOpen(true);
    // 加载员工列表用于选择
    try {
      const res = await employeeApi.list({ page_size: 500 });
      setEmployees(res.items);
    } catch {
      message.error('加载员工列表失败');
    }
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      const emp = employees.find((e) => e.id === values.evaluator_id);
      if (!emp) {
        message.error('未找到选定员工');
        return;
      }
      await evaluationApi.updateRelation(editingRelation!.id, {
        evaluator_id: emp.id,
        evaluator_name: emp.name,
      });
      message.success('修改成功');
      setEditOpen(false);
      loadRelations();
    } catch {
      message.error('修改失败');
    } finally {
      setEditLoading(false);
    }
  };

  // 表列
  const columns: ColumnsType<EvalRelation> = [
    { title: '被评人', dataIndex: 'evaluatee_name', width: 100, fixed: 'left' },
    { title: '被评人考核类型', dataIndex: 'evaluatee_assess_type', width: 130 },
    { title: '评价人', dataIndex: 'evaluator_name', width: 100 },
    {
      title: '评价人类型',
      dataIndex: 'evaluator_type',
      width: 120,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          '同事': 'blue',
          '上级领导': 'orange',
          '部门领导': 'red',
          '基层管理互评': 'purple',
          '部门员工': 'green',
        };
        return <Tag color={colorMap[v] || 'default'}>{v}</Tag>;
      },
    },
    { title: '序号', dataIndex: 'evaluator_order', width: 60, align: 'center' },
    {
      title: '状态',
      dataIndex: 'is_completed',
      width: 80,
      align: 'center',
      render: (v: boolean) =>
        v ? <Tag color="success">已完成</Tag> : <Tag color="warning">待评价</Tag>,
    },
    {
      title: '操作',
      width: 70,
      fixed: 'right',
      render: (_: unknown, record: EvalRelation) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => openEdit(record)}
          disabled={record.is_completed}
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 进度统计 */}
      {progress && (
        <Card
          style={{
            marginBottom: 16,
            borderRadius: 'var(--neu-radius-md)',
            boxShadow: 'var(--neu-shadow-out-1)',
            border: 'none',
          }}
        >
          <Row gutter={24} align="middle">
            <Col span={4}>
              <Statistic title="总评价数" value={progress.total} />
            </Col>
            <Col span={4}>
              <Statistic title="已完成" value={progress.completed} valueStyle={{ color: '#52c41a' }} />
            </Col>
            <Col span={4}>
              <Statistic title="未完成" value={progress.pending} valueStyle={{ color: '#faad14' }} />
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 4, fontSize: 13, color: 'var(--neu-text-secondary, #666)' }}>
                评价进度
              </div>
              <Progress
                percent={Math.round(progress.progress * 100)}
                status={progress.progress >= 1 ? 'success' : 'active'}
                strokeColor={{ from: '#108ee9', to: '#87d068' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Card
        title="互评关系管理"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={generating}
              onClick={handleGenerate}
            >
              生成互评关系
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Excel
            </Button>
          </Space>
        }
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="被评人姓名"
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 160 }}
            value={filter.evaluatee_name}
            onChange={(e) => setFilter((f) => ({ ...f, evaluatee_name: e.target.value }))}
            onPressEnter={loadRelations}
          />
          <Select
            placeholder="评价人类型"
            allowClear
            style={{ width: 140 }}
            value={filter.evaluator_type}
            onChange={(v) => setFilter((f) => ({ ...f, evaluator_type: v }))}
            options={EVALUATOR_TYPES.map((t) => ({ label: t, value: t }))}
          />
          <Select
            placeholder="部门"
            allowClear
            style={{ width: 140 }}
            value={filter.department}
            onChange={(v) => setFilter((f) => ({ ...f, department: v }))}
            options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={loadRelations}>
            查询
          </Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={relations}
          loading={loading}
          scroll={{ x: 800 }}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* 编辑评价人 Modal */}
      <Modal
        title="修改评价人"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEditSubmit}
        confirmLoading={editLoading}
        destroyOnClose
      >
        {editingRelation && (
          <div style={{ marginBottom: 16, color: 'var(--neu-text-secondary, #666)' }}>
            被评人：<strong>{editingRelation.evaluatee_name}</strong>，
            评价人类型：<Tag>{editingRelation.evaluator_type}</Tag>
          </div>
        )}
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="新评价人"
            name="evaluator_id"
            rules={[{ required: true, message: '请选择评价人' }]}
          >
            <Select
              showSearch
              placeholder="搜索并选择员工"
              optionFilterProp="label"
              options={employees.map((e) => ({
                label: `${e.name}（${e.department} - ${e.group_name || ''}）`,
                value: e.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

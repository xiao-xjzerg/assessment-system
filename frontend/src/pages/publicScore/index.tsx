/**
 * 公共积分申报页 —— 所有登录用户可见。
 *
 * 功能：
 *   - 员工视图：申报公共/转型活动（CRUD），系统自动计算规模值/复杂性值/工作量系数/积分
 *   - 管理员视图：查看全部申报记录，可直接修改工作量系数和积分，按员工/类型/状态筛选
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
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
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { publicScoreApi } from '@/services/api/publicScore';
import type { PublicScore, PublicScoreCreate } from '@/types';
import {
  PUBLIC_ACTIVITY_TYPES,
  COMPLEXITY_LEVELS,
} from '@/utils/constants';
import { formatCoeff, formatNumber } from '@/utils/format';
import { useUserStore } from '@/stores/userStore';

/** 员工端申报表单 */
interface CreateFormValues {
  activity_name: string;
  activity_type: string;
  man_months: number;
  complexity: string;
  remark?: string;
}

/** 管理员编辑表单（额外可改工作量系数和积分） */
interface AdminEditFormValues extends CreateFormValues {
  workload_coeff?: number;
  score?: number;
}

export default function PublicScorePage() {
  const { message, modal } = AntdApp.useApp();
  const isAdmin = useUserStore((s) => s.isAdmin());

  // 数据
  const [data, setData] = useState<PublicScore[]>([]);
  const [loading, setLoading] = useState(false);

  // 筛选（管理员）
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PublicScore | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();

  // 加载数据
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (isAdmin) {
        if (filterName) params.employee_name = filterName;
        if (filterType) params.activity_type = filterType;
        if (filterStatus) params.status = filterStatus;
      }
      const res = await publicScoreApi.list(params);
      setData(res);
    } catch {
      message.error('加载公共积分数据失败');
    } finally {
      setLoading(false);
    }
  }, [message, isAdmin, filterName, filterType, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  // 打开新增
  const openCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  // 打开编辑
  const openEdit = (record: PublicScore) => {
    setEditingRecord(record);
    form.setFieldsValue({
      activity_name: record.activity_name,
      activity_type: record.activity_type,
      man_months: Number(record.man_months),
      complexity: record.complexity,
      remark: record.remark || '',
      ...(isAdmin
        ? {
            workload_coeff: Number(record.workload_coeff),
            score: Number(record.score),
          }
        : {}),
    });
    setModalOpen(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);

      if (editingRecord) {
        // 编辑
        const updateData: Record<string, unknown> = {
          activity_name: values.activity_name,
          activity_type: values.activity_type,
          man_months: values.man_months,
          complexity: values.complexity,
          remark: values.remark || null,
        };
        if (isAdmin) {
          if (values.workload_coeff !== undefined) updateData.workload_coeff = values.workload_coeff;
          if (values.score !== undefined) updateData.score = values.score;
        }
        await publicScoreApi.update(editingRecord.id, updateData);
        message.success('修改成功');
      } else {
        // 新增
        const body: PublicScoreCreate = {
          activity_name: values.activity_name,
          activity_type: values.activity_type,
          man_months: values.man_months,
          complexity: values.complexity,
          remark: values.remark || null,
        };
        await publicScoreApi.create(body);
        message.success('申报成功');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // 表单校验错误
      message.error(editingRecord ? '修改失败' : '申报失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  // 删除
  const handleDelete = async (id: number) => {
    try {
      await publicScoreApi.remove(id);
      message.success('删除成功');
      load();
    } catch {
      message.error('删除失败');
    }
  };

  // 状态 Tag
  const statusTag = (status: string | null) => {
    if (!status) return <Tag>待审核</Tag>;
    if (status === '管理员已修改') return <Tag color="orange">管理员已修改</Tag>;
    return <Tag color="blue">{status}</Tag>;
  };

  // 列定义
  const columns: ColumnsType<PublicScore> = useMemo(() => {
    const cols: ColumnsType<PublicScore> = [];
    if (isAdmin) {
      cols.push({
        title: '员工姓名',
        dataIndex: 'employee_name',
        width: 100,
        fixed: 'left' as const,
      });
    }
    cols.push(
      {
        title: '活动名称',
        dataIndex: 'activity_name',
        ellipsis: true,
        width: 200,
      },
      {
        title: '活动类型',
        dataIndex: 'activity_type',
        width: 100,
        render: (t: string) => (
          <Tag color={t === '转型活动' ? 'purple' : 'cyan'}>{t}</Tag>
        ),
      },
      {
        title: '人月',
        dataIndex: 'man_months',
        width: 80,
        render: (v: number | string) => formatNumber(v, 2),
      },
      {
        title: '复杂度',
        dataIndex: 'complexity',
        width: 80,
      },
      {
        title: '规模值',
        dataIndex: 'scale_value',
        width: 90,
        render: (v: number | string) => formatCoeff(v),
      },
      {
        title: '复杂性值',
        dataIndex: 'complexity_value',
        width: 90,
        render: (v: number | string) => formatCoeff(v),
      },
      {
        title: '工作量系数',
        dataIndex: 'workload_coeff',
        width: 100,
        render: (v: number | string) => formatCoeff(v),
      },
      {
        title: '积分',
        dataIndex: 'score',
        width: 80,
        render: (v: number | string) => formatNumber(v, 2),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: statusTag,
      },
      {
        title: '操作',
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, record: PublicScore) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm title="确认删除此申报？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ),
      },
    );
    return cols;
  }, [isAdmin]);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="公共积分申报"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增申报
          </Button>
        }
      >
        {/* 管理员筛选区 */}
        {isAdmin && (
          <Space wrap style={{ marginBottom: 16 }}>
            <Input
              placeholder="员工姓名"
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 160 }}
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              onPressEnter={() => load()}
            />
            <Select
              placeholder="活动类型"
              allowClear
              style={{ width: 140 }}
              value={filterType}
              onChange={(val) => setFilterType(val)}
              options={PUBLIC_ACTIVITY_TYPES.map((t) => ({ label: t, value: t }))}
            />
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 140 }}
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={[
                { label: '待审核', value: '待审核' },
                { label: '管理员已修改', value: '管理员已修改' },
              ]}
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => load()}>
              查询
            </Button>
          </Space>
        )}

        <Table<PublicScore>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: isAdmin ? 1300 : 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          size="middle"
        />
      </Card>

      {/* 新增 / 编辑 Modal */}
      <Modal
        title={editingRecord ? '编辑公共积分申报' : '新增公共积分申报'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={confirmLoading}
        destroyOnClose
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="activity_name"
            label="活动名称"
            rules={[{ required: true, message: '请输入活动名称' }]}
          >
            <Input placeholder="请输入活动名称" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="activity_type"
            label="活动类型"
            rules={[{ required: true, message: '请选择活动类型' }]}
          >
            <Select
              placeholder="请选择活动类型"
              options={PUBLIC_ACTIVITY_TYPES.map((t) => ({ label: t, value: t }))}
            />
          </Form.Item>

          <Form.Item
            name="man_months"
            label="投入人力（人月）"
            rules={[{ required: true, message: '请输入投入人力' }]}
          >
            <InputNumber min={0} step={0.1} precision={2} style={{ width: '100%' }} placeholder="请输入人月数" />
          </Form.Item>

          <Form.Item
            name="complexity"
            label="复杂度"
            rules={[{ required: true, message: '请选择复杂度' }]}
          >
            <Select
              placeholder="请选择复杂度"
              options={COMPLEXITY_LEVELS.map((c) => ({ label: c, value: c }))}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} maxLength={500} placeholder="备注（可选）" />
          </Form.Item>

          {/* 管理员额外字段 */}
          {isAdmin && editingRecord && (
            <>
              <Form.Item name="workload_coeff" label="工作量系数（管理员修改）">
                <InputNumber min={0} step={0.01} precision={4} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="score" label="积分（管理员修改）">
                <InputNumber min={0} step={0.1} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}

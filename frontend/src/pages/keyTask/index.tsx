/**
 * 重点任务申报 —— 基层管理人员自行申请制（多条）。
 *
 * 权限：管理员 / 领导 / 基层管理人员（role=普通员工 + assess_type=基层管理人员）
 *
 * 基层管理人员视图：表格显示本人申请，"添加"/"编辑"走 Modal，保存后 Modal 关闭回到列表；
 *   Modal 的"保存"按钮根据「本人其他申请合计 + 表单当前分值」实时预测，超 10 时置灰并 Tooltip 提示。
 * 管理员 / 领导视图：全部申请的扁平表格，支持新增（选员工）、编辑、删除。
 *
 * 合计上限：单员工全部申请 score 合计不得超过 10（后端强校验，前端提示）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Form,
  Input,
  Modal,
  InputNumber,
  Popconfirm,
  Tag,
  Alert,
  Select,
  Tooltip,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { bonusApi } from '@/services/api/bonus';
import { employeeApi } from '@/services/api/employee';
import { useUserStore } from '@/stores/userStore';
import { ROLE, ASSESS_TYPE } from '@/utils/constants';
import type { Employee, KeyTaskScore } from '@/types';

const MAX_TOTAL = 10;

export default function KeyTaskPage() {
  const { message } = AntdApp.useApp();
  const user = useUserStore((s) => s.user);

  const role = user?.role;
  const isSelfOnly =
    role === ROLE.EMPLOYEE && user?.assess_type === ASSESS_TYPE.MANAGER;
  const isManageAll = role === ROLE.ADMIN || role === ROLE.LEADER;

  if (!isSelfOnly && !isManageAll) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          showIcon
          message="暂无权限"
          description="仅基层管理人员、领导、管理员可访问重点任务申报。"
        />
      </div>
    );
  }

  return isSelfOnly ? (
    <SelfApplyPanel userId={user!.user_id} message={message} />
  ) : (
    <ManageAllPanel message={message} />
  );
}

// ==================== 基层管理人员自己申请的视图 ====================

interface SelfProps {
  userId: number;
  message: ReturnType<typeof AntdApp.useApp>['message'];
}

interface SelfFormVals {
  task_name: string;
  completion: string;
  score: number;
}

function SelfApplyPanel({ userId, message }: SelfProps) {
  const [list, setList] = useState<KeyTaskScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KeyTaskScore | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<SelfFormVals>();

  // 监听表单中 score 字段的实时值，用于预测合计
  const watchedScore = Form.useWatch('score', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bonusApi.listKeyTasks();
      setList(res);
    } catch {
      message.error('加载申请列表失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const persistedTotal = useMemo(
    () => list.reduce((sum, r) => sum + (Number(r.score) || 0), 0),
    [list],
  );

  /** 除"当前编辑行"之外的已有申请合计（新增时即 persistedTotal） */
  const otherSum = useMemo(() => {
    if (!editing) return persistedTotal;
    return persistedTotal - (Number(editing.score) || 0);
  }, [persistedTotal, editing]);

  const projectedTotal = otherSum + (Number(watchedScore) || 0);
  const overLimitOnSave = projectedTotal > MAX_TOTAL;

  const initialFormValues = useMemo<SelfFormVals | undefined>(() => {
    if (!editing) return undefined;
    return {
      task_name: editing.task_name,
      completion: editing.completion,
      score: Number(editing.score) || 0,
    };
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: KeyTaskScore) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleDelete = async (row: KeyTaskScore) => {
    try {
      await bonusApi.removeKeyTask(row.id);
      message.success('已删除');
      load();
    } catch {
      // 拦截器已提示
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editing) {
        await bonusApi.updateKeyTask(editing.id, {
          task_name: values.task_name.trim(),
          completion: values.completion.trim(),
          score: values.score,
        });
      } else {
        await bonusApi.createKeyTask({
          employee_id: userId,
          task_name: values.task_name.trim(),
          completion: values.completion.trim(),
          score: values.score,
        });
      }
      message.success(editing ? '保存成功' : '添加成功');
      setFormOpen(false);
      load();
    } catch {
      // 拦截器已提示（例如合计超 10 的 400）
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<KeyTaskScore> = [
    {
      title: '序号',
      width: 70,
      align: 'center',
      render: (_: unknown, __: KeyTaskScore, idx: number) => idx + 1,
    },
    {
      title: '重点任务名称',
      dataIndex: 'task_name',
      width: 240,
      ellipsis: true,
    },
    {
      title: '完成情况',
      dataIndex: 'completion',
      ellipsis: true,
    },
    {
      title: '申请分值',
      dataIndex: 'score',
      width: 110,
      align: 'right',
      render: (v: number | string) => Number(v).toFixed(1),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该申请？"
            description={`任务名称：${row.task_name || '(未填写)'}`}
            okText="删除"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(row)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const saveTooltip = overLimitOnSave
    ? `保存后本人合计将达 ${projectedTotal.toFixed(1)} 分，超出上限 ${MAX_TOTAL}`
    : '';

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="重点任务申报"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Space>
            <Tag
              color={
                persistedTotal > MAX_TOTAL
                  ? 'red'
                  : persistedTotal === MAX_TOTAL
                    ? 'orange'
                    : 'blue'
              }
            >
              当前申请合计 {persistedTotal.toFixed(1)} / {MAX_TOTAL}
            </Tag>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              添加
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="请录入本人本期重点任务完成情况。单员工全部申请分值合计不得超过 10 分。"
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        open={formOpen}
        title={editing ? '编辑重点任务申请' : '添加重点任务申请'}
        onCancel={() => setFormOpen(false)}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setFormOpen(false)}>
            取消
          </Button>,
          // 禁用态按钮不响应 hover 事件，外层 span 承载 Tooltip
          <Tooltip key="save" title={saveTooltip} placement="top">
            <span style={{ display: 'inline-block' }}>
              <Button
                type="primary"
                loading={submitting}
                disabled={overLimitOnSave}
                onClick={handleSubmit}
              >
                保存
              </Button>
            </span>
          </Tooltip>,
        ]}
      >
        <Form
          form={form}
          preserve={false}
          layout="vertical"
          initialValues={initialFormValues ?? { score: 1 }}
        >
          <Form.Item
            name="task_name"
            label="重点任务名称"
            extra="根据年初下达的重点任务目标填写"
            rules={[
              { required: true, message: '请填写重点任务名称' },
              { max: 200, message: '最多 200 字' },
            ]}
          >
            <Input placeholder="请输入重点任务名称" />
          </Form.Item>
          <Form.Item
            name="completion"
            label="完成情况"
            extra="填写当前完成情况，以及团队成员"
            rules={[
              { required: true, message: '请填写完成情况' },
              { max: 1000, message: '最多 1000 字' },
            ]}
          >
            <Input.TextArea rows={4} showCount maxLength={1000} />
          </Form.Item>
          <Form.Item
            name="score"
            label="申请分值"
            extra={`1~10 分，本人其他申请已合计 ${otherSum.toFixed(1)} 分`}
            rules={[{ required: true, message: '请填写申请分值' }]}
          >
            <InputNumber min={1} max={10} step={0.5} precision={1} style={{ width: 160 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ==================== 管理员 / 领导：全部申请表格 ====================

interface ManageProps {
  message: ReturnType<typeof AntdApp.useApp>['message'];
}

interface FormVals {
  employee_id: number;
  task_name: string;
  completion: string;
  score: number;
}

function ManageAllPanel({ message }: ManageProps) {
  const [list, setList] = useState<KeyTaskScore[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KeyTaskScore | null>(null);
  const [form] = Form.useForm<FormVals>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ks, mgrs] = await Promise.all([
        bonusApi.listKeyTasks(),
        employeeApi.fetchAll({ assess_type: ASSESS_TYPE.MANAGER }),
      ]);
      setList(ks);
      setManagers(mgrs.filter((e) => e.is_active));
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  // 各员工合计，用于显示
  const totalByEmp = useMemo(() => {
    const map = new Map<number, number>();
    list.forEach((r) => {
      map.set(r.employee_id, (map.get(r.employee_id) ?? 0) + Number(r.score));
    });
    return map;
  }, [list]);

  const initialFormValues = useMemo<FormVals | undefined>(() => {
    if (!editing) return undefined;
    return {
      employee_id: editing.employee_id,
      task_name: editing.task_name,
      completion: editing.completion,
      score: Number(editing.score) || 0,
    };
  }, [editing]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: KeyTaskScore) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleDelete = async (row: KeyTaskScore) => {
    try {
      await bonusApi.removeKeyTask(row.id);
      message.success('已删除');
      load();
    } catch {
      // 拦截器已提示
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await bonusApi.updateKeyTask(editing.id, {
          task_name: values.task_name.trim(),
          completion: values.completion.trim(),
          score: values.score,
        });
      } else {
        await bonusApi.createKeyTask({
          employee_id: values.employee_id,
          task_name: values.task_name.trim(),
          completion: values.completion.trim(),
          score: values.score,
        });
      }
      message.success(editing ? '保存成功' : '添加成功');
      setFormOpen(false);
      load();
    } catch {
      // 拦截器已提示（例如合计超 10 的 400）
    }
  };

  const columns: ColumnsType<KeyTaskScore> = [
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      width: 200,
      fixed: 'left',
      render: (name: string, record) => {
        const total = totalByEmp.get(record.employee_id) ?? 0;
        return (
          <Space size={4} wrap={false} style={{ whiteSpace: 'nowrap' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{name}</span>
            <Tag
              color={total > MAX_TOTAL ? 'red' : 'blue'}
              style={{ marginInlineEnd: 0 }}
            >
              合计 {total}/10
            </Tag>
          </Space>
        );
      },
    },
    {
      title: '重点任务名称',
      dataIndex: 'task_name',
      width: 220,
      ellipsis: true,
    },
    {
      title: '完成情况',
      dataIndex: 'completion',
      ellipsis: true,
    },
    {
      title: '申请分值',
      dataIndex: 'score',
      width: 100,
      align: 'right',
      render: (v: number | string) => Number(v).toFixed(1),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该申请？"
            okText="删除"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(row)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="重点任务申报（全部）"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            添加
          </Button>
        }
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="查看/维护全部基层管理人员的重点任务申请。单员工全部申请分值合计不得超过 10。"
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          scroll={{ x: 1080 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        open={formOpen}
        title={editing ? '编辑重点任务申请' : '添加重点任务申请'}
        onCancel={() => setFormOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        destroyOnClose
      >
        <Form
          form={form}
          preserve={false}
          layout="vertical"
          initialValues={
            initialFormValues ?? { score: 1 }
          }
        >
          <Form.Item
            name="employee_id"
            label="员工"
            rules={[{ required: true, message: '请选择员工' }]}
          >
            <Select
              showSearch
              disabled={!!editing}
              placeholder="选择基层管理人员"
              options={managers.map((m) => ({
                value: m.id,
                label: `${m.name}（${m.department}${m.group_name ? ' · ' + m.group_name : ''}）`,
              }))}
              filterOption={(input, option) =>
                (option?.label as string).toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="task_name"
            label="重点任务名称"
            extra="根据年初下达的重点任务目标填写"
            rules={[
              { required: true, message: '请填写重点任务名称' },
              { max: 200, message: '最多 200 字' },
            ]}
          >
            <Input placeholder="请输入重点任务名称" />
          </Form.Item>
          <Form.Item
            name="completion"
            label="完成情况"
            extra="填写当前完成情况，以及团队成员"
            rules={[
              { required: true, message: '请填写完成情况' },
              { max: 1000, message: '最多 1000 字' },
            ]}
          >
            <Input.TextArea rows={4} showCount maxLength={1000} />
          </Form.Item>
          <Form.Item
            name="score"
            label="申请分值"
            extra="1~10 分，单员工合计不得超过 10"
            rules={[{ required: true, message: '请填写申请分值' }]}
          >
            <InputNumber min={1} max={10} step={0.5} precision={1} style={{ width: 160 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

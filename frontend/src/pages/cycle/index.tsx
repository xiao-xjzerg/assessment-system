/**
 * 考核周期管理页 —— 仅管理员可见。
 *
 * 功能：
 *   - 周期列表（名称、阶段、状态）
 *   - 创建新周期（Modal 输入名称）
 *   - 激活周期
 *   - 归档周期（Popconfirm 二次确认）
 *   - 阶段前进 / 回退
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Form,
  Modal,
  Input,
  Tag,
  Popconfirm,
  Tooltip,
  App as AntdApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { cycleApi } from '@/services/api/cycle';
import { useCycleStore } from '@/stores/cycleStore';
import { ASSESSMENT_PHASES } from '@/utils/constants';
import type { Cycle } from '@/types';

export default function CyclePage() {
  const { message, modal } = AntdApp.useApp();
  const { setActive } = useCycleStore();

  const [data, setData] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ name: string }>();

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await cycleApi.list();
      setData(list);
    } catch {
      // 拦截器已处理
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ---- 创建周期 ----
  const onCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      const cycle = await cycleApi.create({ name: values.name.trim() });
      message.success(`考核周期「${cycle.name}」创建成功`);
      setCreateOpen(false);
      form.resetFields();
      fetchList();
      // 如果是第一个周期且自动激活，更新全局状态
      if (cycle.is_active) {
        setActive(cycle);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
    } finally {
      setCreating(false);
    }
  };

  // ---- 激活周期 ----
  const onActivate = async (row: Cycle) => {
    try {
      const cycle = await cycleApi.activate(row.id);
      message.success(`已激活「${cycle.name}」`);
      setActive(cycle);
      fetchList();
    } catch {
      // 拦截器已处理
    }
  };

  // ---- 归档周期 ----
  const onArchive = async (row: Cycle) => {
    try {
      const cycle = await cycleApi.archive(row.id);
      message.success(`「${cycle.name}」已归档`);
      // 若归档的是当前活跃周期，清除
      if (row.is_active) {
        setActive(null);
      }
      fetchList();
    } catch {
      // 拦截器已处理
    }
  };

  // ---- 阶段切换 ----
  const onChangePhase = async (row: Cycle, action: 'next' | 'prev') => {
    const targetPhase = action === 'next' ? row.phase + 1 : row.phase - 1;
    const targetName = ASSESSMENT_PHASES[targetPhase] || `阶段${targetPhase}`;
    const dir = action === 'next' ? '前进' : '回退';

    modal.confirm({
      title: `确认${dir}阶段？`,
      content: `将从「${ASSESSMENT_PHASES[row.phase] || ''}」${dir}到「${targetName}」`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          const cycle = await cycleApi.changePhase(row.id, { action });
          message.success(`已切换到 ${ASSESSMENT_PHASES[cycle.phase] || ''}`);
          if (row.is_active) {
            setActive(cycle);
          }
          fetchList();
        } catch {
          // 拦截器已处理
        }
      },
    });
  };

  // ---- 表格列 ----
  const columns: ColumnsType<Cycle> = useMemo(
    () => [
      {
        title: '周期名称',
        dataIndex: 'name',
        width: 200,
      },
      {
        title: '当前阶段',
        dataIndex: 'phase',
        width: 200,
        render: (phase: number) => {
          const name = ASSESSMENT_PHASES[phase] || `阶段${phase}`;
          const colors = ['', 'blue', 'cyan', 'orange', 'green', 'red'];
          return (
            <Tag color={colors[phase] || 'default'}>
              阶段 {phase} - {name}
            </Tag>
          );
        },
      },
      {
        title: '状态',
        key: 'status',
        width: 150,
        render: (_v, row) => {
          if (row.is_archived) return <Tag>已归档</Tag>;
          if (row.is_active) return <Tag color="green">活跃</Tag>;
          return <Tag color="default">未激活</Tag>;
        },
      },
      {
        title: '阶段操作',
        key: 'phase_action',
        width: 160,
        render: (_v, row) => {
          if (row.is_archived) return <span style={{ color: '#999' }}>-</span>;
          return (
            <Space size={4}>
              <Tooltip title="回退阶段">
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  disabled={row.phase <= 1}
                  onClick={() => onChangePhase(row, 'prev')}
                >
                  回退
                </Button>
              </Tooltip>
              <Tooltip title="前进阶段">
                <Button
                  size="small"
                  type="primary"
                  icon={<RightOutlined />}
                  disabled={row.phase >= 5}
                  onClick={() => onChangePhase(row, 'next')}
                >
                  前进
                </Button>
              </Tooltip>
            </Space>
          );
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 200,
        render: (_v, row) => {
          if (row.is_archived) {
            return <span style={{ color: '#999' }}>已归档，不可操作</span>;
          }
          return (
            <Space size={4}>
              {!row.is_active && (
                <Popconfirm
                  title="确认激活该周期？"
                  description="激活后将成为当前考核周期，原活跃周期会被取消激活。"
                  okText="激活"
                  cancelText="取消"
                  onConfirm={() => onActivate(row)}
                >
                  <Button
                    size="small"
                    type="link"
                    icon={<CheckCircleOutlined />}
                  >
                    激活
                  </Button>
                </Popconfirm>
              )}
              {row.is_active && (
                <Tag color="green" style={{ margin: 0 }}>当前活跃</Tag>
              )}
              <Popconfirm
                title="确认归档该周期？"
                description="归档后数据将保留但无法再修改。"
                okText="归档"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => onArchive(row)}
              >
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<InboxOutlined />}
                >
                  归档
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="考核周期管理"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            创建周期
          </Button>
        }
      >
        <Table<Cycle>
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 创建周期 Modal */}
      <Modal
        title="创建考核周期"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreateSubmit}
        confirmLoading={creating}
        destroyOnClose
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="周期名称"
            name="name"
            rules={[
              { required: true, message: '请输入周期名称' },
              { max: 50, message: '名称不超过 50 字' },
            ]}
          >
            <Input placeholder="如：2026年Q2" maxLength={50} />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>
            创建新周期时会自动继承上一个周期的员工数据和考核参数。
          </div>
        </Form>
      </Modal>
    </div>
  );
}

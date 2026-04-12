/**
 * 员工管理页 —— 仅管理员可见。
 *
 * 功能：
 *   - 列表查询（姓名/手机号搜索 + 部门/组/角色/考核类型筛选 + 分页）
 *   - 新增 / 编辑（Modal 表单）
 *   - 删除（Popconfirm 二次确认）
 *   - 重置密码（确认 → 后端将密码重置为手机号后 6 位）
 *   - Excel 导入（含「全量更新」选项）
 *   - 下载导入模板
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
  Popconfirm,
  Tag,
  Tooltip,
  Upload,
  Switch,
  App as AntdApp,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd/es/upload/interface';
import { employeeApi } from '@/services/api/employee';
import type {
  Employee,
  EmployeeCreate,
  EmployeeListQuery,
  ImportResult,
} from '@/types';
import {
  ALL_ASSESS_TYPES,
  ALL_DEPARTMENTS,
  ALL_ROLES,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '@/utils/constants';
import { downloadBlob, extractFilename } from '@/utils/format';

interface FormValues extends Omit<EmployeeCreate, 'assess_type_secondary'> {
  assess_type_secondary?: string | null;
  is_active?: boolean;
}

export default function EmployeePage() {
  const { message, modal } = AntdApp.useApp();

  const [data, setData] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [filter, setFilter] = useState<{
    search?: string;
    department?: string;
    role?: string;
    assess_type?: string;
  }>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const [importOpen, setImportOpen] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [importReimport, setImportReimport] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const query: EmployeeListQuery = {
        page,
        page_size: pageSize,
        ...filter,
      };
      const resp = await employeeApi.list(query);
      setData(resp.items);
      setTotal(resp.total);
    } catch {
      // 错误已由拦截器处理
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ---- 表单：新增 / 编辑 ----
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (row: Employee) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      department: row.department,
      group_name: row.group_name ?? '',
      position: row.position ?? '',
      grade: row.grade ?? '',
      phone: row.phone,
      role: row.role,
      assess_type: row.assess_type,
      assess_type_secondary: row.assess_type_secondary ?? undefined,
      is_active: row.is_active,
    });
    setFormOpen(true);
  };

  const onSubmitForm = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload: FormValues = {
        ...values,
        group_name: values.group_name?.trim() || null,
        position: values.position?.trim() || null,
        grade: values.grade?.trim() || null,
        assess_type_secondary: values.assess_type_secondary || null,
      };
      if (editing) {
        await employeeApi.update(editing.id, payload);
        message.success('员工已更新');
      } else {
        await employeeApi.create(payload as EmployeeCreate);
        message.success('员工已创建（初始密码为手机号后 6 位）');
      }
      setFormOpen(false);
      fetchList();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // antd 表单校验错误
        return;
      }
      // 其他已由拦截器处理
    } finally {
      setSubmitting(false);
    }
  };

  // ---- 删除 ----
  const onDelete = async (row: Employee) => {
    try {
      await employeeApi.remove(row.id);
      message.success('已删除');
      // 删完当前页若空，回退一页
      if (data.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchList();
      }
    } catch {
      // 错误已展示
    }
  };

  // ---- 重置密码 ----
  const onResetPassword = (row: Employee) => {
    modal.confirm({
      title: `确认重置 ${row.name} 的密码？`,
      content: '密码将被重置为手机号后 6 位，原密码将立即失效。',
      okText: '重置',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await employeeApi.resetPassword(row.id);
          message.success('密码已重置');
        } catch {
          // 错误已展示
        }
      },
    });
  };

  // ---- 模板下载 ----
  const onDownloadTemplate = async () => {
    try {
      const resp = await employeeApi.downloadTemplate();
      const filename = extractFilename(
        resp.headers['content-disposition'] as string | undefined,
        'employee_template.xlsx',
      );
      downloadBlob(resp.data, filename);
    } catch {
      message.error('模板下载失败');
    }
  };

  // ---- Excel 导入 ----
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const ok = /\.(xlsx|xls)$/i.test(file.name);
    if (!ok) {
      message.error('请上传 Excel 文件（.xlsx）');
      return Upload.LIST_IGNORE;
    }
    setImportFileList([file as unknown as UploadFile]);
    return false; // 阻止自动上传
  };

  const handleImport = async () => {
    if (importFileList.length === 0) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    const file = importFileList[0] as unknown as File;
    setImporting(true);
    try {
      const result: ImportResult = await employeeApi.importExcel(
        file,
        importReimport,
      );
      message.success(`成功导入 ${result.success_count} 条记录`);
      if (result.errors && result.errors.length > 0) {
        modal.warning({
          title: '部分记录导入失败',
          content: (
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12 }}>
                  {e}
                </div>
              ))}
            </div>
          ),
        });
      }
      setImportOpen(false);
      setImportFileList([]);
      setImportReimport(false);
      fetchList();
    } catch {
      // 错误已展示
    } finally {
      setImporting(false);
    }
  };

  // ---- 表格列 ----
  const columns: ColumnsType<Employee> = useMemo(
    () => [
      { title: '姓名', dataIndex: 'name', width: 100, fixed: 'left' },
      { title: '手机号', dataIndex: 'phone', width: 130 },
      { title: '部门', dataIndex: 'department', width: 130 },
      {
        title: '组/中心',
        dataIndex: 'group_name',
        width: 130,
        render: (v) => v || '-',
      },
      {
        title: '岗位',
        dataIndex: 'position',
        width: 140,
        render: (v) => v || '-',
      },
      { title: '岗级', dataIndex: 'grade', width: 80, render: (v) => v || '-' },
      {
        title: '角色',
        dataIndex: 'role',
        width: 100,
        render: (v: string) => <Tag color="blue">{v}</Tag>,
      },
      {
        title: '考核类型',
        dataIndex: 'assess_type',
        width: 130,
        render: (v: string, row) => (
          <Space size={4}>
            <Tag color="purple">{v}</Tag>
            {row.assess_type_secondary && (
              <Tag color="magenta">{row.assess_type_secondary}</Tag>
            )}
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'is_active',
        width: 80,
        render: (v: boolean) =>
          v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
      },
      {
        title: '操作',
        key: 'action',
        width: 220,
        fixed: 'right',
        render: (_v, row) => (
          <Space size={4}>
            <Tooltip title="编辑">
              <Button
                size="small"
                type="link"
                icon={<EditOutlined />}
                onClick={() => openEdit(row)}
              >
                编辑
              </Button>
            </Tooltip>
            <Tooltip title="重置密码">
              <Button
                size="small"
                type="link"
                icon={<KeyOutlined />}
                onClick={() => onResetPassword(row)}
              >
                重置
              </Button>
            </Tooltip>
            <Popconfirm
              title="确认删除该员工？"
              description="删除后将级联影响所有关联评分数据，请谨慎操作。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(row)}
            >
              <Button
                size="small"
                type="link"
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const onTableChange = (p: TablePaginationConfig) => {
    if (p.current && p.current !== page) setPage(p.current);
    if (p.pageSize && p.pageSize !== pageSize) {
      setPageSize(p.pageSize);
      setPage(1);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="员工管理"
        style={{
          borderRadius: 'var(--neu-radius-md)',
          boxShadow: 'var(--neu-shadow-out-2)',
          border: 'none',
        }}
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={onDownloadTemplate}>
              下载模板
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              导入 Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增员工
            </Button>
          </Space>
        }
      >
        {/* 筛选区 */}
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="姓名 / 手机号"
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
            value={filter.search}
            onChange={(e) =>
              setFilter((f) => ({ ...f, search: e.target.value }))
            }
            onPressEnter={() => {
              setPage(1);
              fetchList();
            }}
          />
          <Select
            placeholder="部门"
            allowClear
            style={{ width: 140 }}
            value={filter.department}
            options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
            onChange={(v) => {
              setFilter((f) => ({ ...f, department: v }));
              setPage(1);
            }}
          />
          <Select
            placeholder="角色"
            allowClear
            style={{ width: 140 }}
            value={filter.role}
            options={ALL_ROLES.map((r) => ({ label: r, value: r }))}
            onChange={(v) => {
              setFilter((f) => ({ ...f, role: v }));
              setPage(1);
            }}
          />
          <Select
            placeholder="考核类型"
            allowClear
            style={{ width: 160 }}
            value={filter.assess_type}
            options={ALL_ASSESS_TYPES.map((a) => ({ label: a, value: a }))}
            onChange={(v) => {
              setFilter((f) => ({ ...f, assess_type: v }));
              setPage(1);
            }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              setPage(1);
              fetchList();
            }}
          >
            查询
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setFilter({});
              setPage(1);
            }}
          >
            重置
          </Button>
        </Space>

        <Table<Employee>
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={onTableChange}
        />
      </Card>

      {/* 新增 / 编辑表单 */}
      <Modal
        title={editing ? '编辑员工' : '新增员工'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={onSubmitForm}
        confirmLoading={submitting}
        destroyOnClose
        width={640}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          autoComplete="off"
          preserve={false}
        >
          <Space.Compact block>
            <Form.Item
              label="姓名"
              name="name"
              rules={[{ required: true, message: '请输入姓名' }]}
              style={{ flex: 1, marginRight: 8 }}
            >
              <Input placeholder="姓名" maxLength={50} />
            </Form.Item>
            <Form.Item
              label="手机号"
              name="phone"
              rules={[
                { required: true, message: '请输入手机号' },
                { pattern: /^1\d{10}$/, message: '手机号格式不正确' },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="11 位手机号" maxLength={11} />
            </Form.Item>
          </Space.Compact>

          <Space.Compact block>
            <Form.Item
              label="部门"
              name="department"
              rules={[{ required: true, message: '请选择部门' }]}
              style={{ flex: 1, marginRight: 8 }}
            >
              <Select
                placeholder="部门"
                options={ALL_DEPARTMENTS.map((d) => ({ label: d, value: d }))}
              />
            </Form.Item>
            <Form.Item
              label="组/中心"
              name="group_name"
              style={{ flex: 1 }}
            >
              <Input placeholder="可选" maxLength={50} />
            </Form.Item>
          </Space.Compact>

          <Space.Compact block>
            <Form.Item
              label="岗位"
              name="position"
              style={{ flex: 1, marginRight: 8 }}
            >
              <Input placeholder="可选" maxLength={50} />
            </Form.Item>
            <Form.Item label="岗级" name="grade" style={{ flex: 1 }}>
              <Input placeholder="如 T5 / S3" maxLength={20} />
            </Form.Item>
          </Space.Compact>

          <Space.Compact block>
            <Form.Item
              label="角色"
              name="role"
              rules={[{ required: true, message: '请选择角色' }]}
              style={{ flex: 1, marginRight: 8 }}
            >
              <Select
                placeholder="角色"
                options={ALL_ROLES.map((r) => ({ label: r, value: r }))}
              />
            </Form.Item>
            <Form.Item
              label="考核类型"
              name="assess_type"
              rules={[{ required: true, message: '请选择考核类型' }]}
              style={{ flex: 1 }}
            >
              <Select
                placeholder="考核类型"
                options={ALL_ASSESS_TYPES.map((a) => ({ label: a, value: a }))}
              />
            </Form.Item>
          </Space.Compact>

          <Form.Item
            label="第二考核类型（混合角色，可选）"
            name="assess_type_secondary"
          >
            <Select
              placeholder="如同时具备两种身份请填写"
              allowClear
              options={ALL_ASSESS_TYPES.map((a) => ({ label: a, value: a }))}
            />
          </Form.Item>

          {editing && (
            <Form.Item label="账号状态" name="is_active" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 导入 Excel */}
      <Modal
        title="导入员工 Excel"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={handleImport}
        confirmLoading={importing}
        okText="开始导入"
        cancelText="取消"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Upload.Dragger
            beforeUpload={beforeUpload}
            fileList={importFileList}
            onRemove={() => setImportFileList([])}
            maxCount={1}
            accept=".xlsx,.xls"
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 Excel 文件到此处</p>
            <p className="ant-upload-hint">
              仅支持 .xlsx 格式，单次最多 1 个文件
            </p>
          </Upload.Dragger>
          <Space>
            <Switch
              checked={importReimport}
              onChange={setImportReimport}
              checkedChildren="全量更新"
              unCheckedChildren="增量导入"
            />
            <span style={{ fontSize: 12, color: '#999' }}>
              {importReimport
                ? '会清空当前周期已有员工后再导入'
                : '只新增不存在的员工，重复手机号会被跳过'}
            </span>
          </Space>
        </Space>
      </Modal>
    </div>
  );
}

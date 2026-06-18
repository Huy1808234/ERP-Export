'use client';

import {
  CheckSquareOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTheme } from '@/context/theme.context';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import type {
  RolePermission,
  RolePermissionAssignment,
  RoleWithPermissions,
} from '@/types/role-permission';
import {
  App,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Input,
  Progress,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { CollapseProps } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

type DraftByRoleRef = Record<string, string[]>;

type BusinessModuleKey =
  | 'system'
  | 'accounting'
  | 'exportDocuments'
  | 'salesContracts'
  | 'sensitiveFields'
  | 'general';

type BusinessActionKey =
  | 'view'
  | 'createEdit'
  | 'edit'
  | 'manage'
  | 'fullAccess'
  | 'custom';

type PermissionCopyKey =
  | 'readAll'
  | 'manageAll'
  | 'readAccounting'
  | 'writeAccounting'
  | 'readExportDocument'
  | 'writeExportDocument'
  | 'readSalesContract'
  | 'writeSalesContract'
  | 'readCostPrice'
  | 'readCostFields'
  | 'writeCostFields'
  | 'updateCostFields'
  | 'manageCostFields'
  | 'readBankFields'
  | 'readPaymentFields'
  | 'manageBankFields'
  | 'readTradeFinance'
  | 'manageTradeFinance'
  | 'readLcSensitive';

interface PermissionCatalogEntry {
  moduleKey: BusinessModuleKey;
  copyKey: PermissionCopyKey;
  actionKey: BusinessActionKey;
  sortOrder: number;
}

interface BusinessPermissionView {
  permission: RolePermission;
  moduleKey: BusinessModuleKey;
  moduleLabel: string;
  title: string;
  description: string;
  actionKey: BusinessActionKey;
  actionLabel: string;
  sortOrder: number;
}

interface PermissionGroup {
  moduleKey: BusinessModuleKey;
  moduleLabel: string;
  permissions: BusinessPermissionView[];
}

const permissionCatalog: Record<string, PermissionCatalogEntry> = {
  'read:all': {
    moduleKey: 'system',
    copyKey: 'readAll',
    actionKey: 'view',
    sortOrder: 10,
  },
  'manage:all': {
    moduleKey: 'system',
    copyKey: 'manageAll',
    actionKey: 'fullAccess',
    sortOrder: 20,
  },
  'read:accounting': {
    moduleKey: 'accounting',
    copyKey: 'readAccounting',
    actionKey: 'view',
    sortOrder: 110,
  },
  'write:accounting': {
    moduleKey: 'accounting',
    copyKey: 'writeAccounting',
    actionKey: 'createEdit',
    sortOrder: 120,
  },
  'read:export_document': {
    moduleKey: 'exportDocuments',
    copyKey: 'readExportDocument',
    actionKey: 'view',
    sortOrder: 210,
  },
  'write:export_document': {
    moduleKey: 'exportDocuments',
    copyKey: 'writeExportDocument',
    actionKey: 'createEdit',
    sortOrder: 220,
  },
  'read:sales_contract': {
    moduleKey: 'salesContracts',
    copyKey: 'readSalesContract',
    actionKey: 'view',
    sortOrder: 310,
  },
  'write:sales_contract': {
    moduleKey: 'salesContracts',
    copyKey: 'writeSalesContract',
    actionKey: 'createEdit',
    sortOrder: 320,
  },
  'read:cost_price': {
    moduleKey: 'sensitiveFields',
    copyKey: 'readCostPrice',
    actionKey: 'view',
    sortOrder: 410,
  },
  'read:cost_fields': {
    moduleKey: 'sensitiveFields',
    copyKey: 'readCostFields',
    actionKey: 'view',
    sortOrder: 420,
  },
  'write:cost_fields': {
    moduleKey: 'sensitiveFields',
    copyKey: 'writeCostFields',
    actionKey: 'createEdit',
    sortOrder: 430,
  },
  'update:cost_fields': {
    moduleKey: 'sensitiveFields',
    copyKey: 'updateCostFields',
    actionKey: 'edit',
    sortOrder: 440,
  },
  'manage:cost_fields': {
    moduleKey: 'sensitiveFields',
    copyKey: 'manageCostFields',
    actionKey: 'manage',
    sortOrder: 450,
  },
  'read:bank_fields': {
    moduleKey: 'sensitiveFields',
    copyKey: 'readBankFields',
    actionKey: 'view',
    sortOrder: 510,
  },
  'read:payment_fields': {
    moduleKey: 'sensitiveFields',
    copyKey: 'readPaymentFields',
    actionKey: 'view',
    sortOrder: 520,
  },
  'manage:bank_fields': {
    moduleKey: 'sensitiveFields',
    copyKey: 'manageBankFields',
    actionKey: 'manage',
    sortOrder: 530,
  },
  'read:trade_finance': {
    moduleKey: 'sensitiveFields',
    copyKey: 'readTradeFinance',
    actionKey: 'view',
    sortOrder: 610,
  },
  'manage:trade_finance': {
    moduleKey: 'sensitiveFields',
    copyKey: 'manageTradeFinance',
    actionKey: 'manage',
    sortOrder: 620,
  },
  'read:lc_sensitive': {
    moduleKey: 'sensitiveFields',
    copyKey: 'readLcSensitive',
    actionKey: 'view',
    sortOrder: 630,
  },
};

const moduleSortOrder: Record<BusinessModuleKey, number> = {
  system: 10,
  salesContracts: 20,
  exportDocuments: 30,
  accounting: 40,
  sensitiveFields: 50,
  general: 90,
};

const actionColorMap: Record<BusinessActionKey, string> = {
  view: 'blue',
  createEdit: 'green',
  edit: 'gold',
  manage: 'purple',
  fullAccess: 'magenta',
  custom: 'default',
};

const buildDraftByRole = (roles: RoleWithPermissions[]): DraftByRoleRef => {
  return roles.reduce<DraftByRoleRef>((acc, role) => {
    acc[role._id] = (role.permissions ?? []).map((permission) => permission._id);
    return acc;
  }, {});
};

const createDraftSignature = (draftByRole: DraftByRoleRef): string => {
  return Object.entries(draftByRole)
    .map(([role_ref, permission_refs]) => ({
      role_ref,
      permission_refs: [...new Set(permission_refs)].sort(),
    }))
    .sort((a, b) => a.role_ref.localeCompare(b.role_ref))
    .map((assignment) => `${assignment.role_ref}:${assignment.permission_refs.join(',')}`)
    .join('|');
};

const humanizeIdentifier = (value: string): string => {
  const normalized = value
    .replace(/[_:./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized) return value;

  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
};

const inferModuleKey = (moduleName: string): BusinessModuleKey => {
  switch (moduleName) {
    case 'SYSTEM':
      return 'system';
    case 'ACCOUNTING':
      return 'accounting';
    case 'EXPORT_DOCUMENTS':
      return 'exportDocuments';
    case 'SALES_CONTRACTS':
      return 'salesContracts';
    case 'FIELD_ACCESS':
      return 'sensitiveFields';
    default:
      return 'general';
  }
};

const inferActionKey = (permissionName: string): BusinessActionKey => {
  const [actionName] = permissionName.split(':');

  switch (actionName) {
    case 'read':
      return 'view';
    case 'write':
      return 'createEdit';
    case 'update':
      return 'edit';
    case 'manage':
      return 'manage';
    default:
      return 'custom';
  }
};

const RolePermissionMatrix = () => {
  const t = useTranslations('RolePermissions');
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { message } = App.useApp();
  const {
    roles,
    permissions,
    loading,
    saving,
    fetchRolePermissions,
    saveRolePermissions,
  } = useRolePermissions();
  const [searchText, setSearchText] = useState('');
  const [activeRoleRef, setActiveRoleRef] = useState<string | null>(null);
  const [draftByRole, setDraftByRole] = useState<DraftByRoleRef>({});

  useEffect(() => {
    const loadData = async () => {
      const result = await fetchRolePermissions();
      if (!result.success) {
        message.error(result.message || t('messages.loadError'));
      }
    };

    loadData();
  }, [fetchRolePermissions, message, t]);

  const baselineDraft = useMemo(() => buildDraftByRole(roles), [roles]);

  useEffect(() => {
    setDraftByRole(baselineDraft);
  }, [baselineDraft]);

  useEffect(() => {
    if (roles.length === 0) {
      setActiveRoleRef(null);
      return;
    }

    const activeRoleExists = roles.some((role) => role._id === activeRoleRef);
    if (!activeRoleRef || !activeRoleExists) {
      setActiveRoleRef(roles[0]._id);
    }
  }, [activeRoleRef, roles]);

  const getModuleLabel = (moduleKey: BusinessModuleKey): string => {
    switch (moduleKey) {
      case 'system':
        return t('modules.system');
      case 'accounting':
        return t('modules.accounting');
      case 'exportDocuments':
        return t('modules.exportDocuments');
      case 'salesContracts':
        return t('modules.salesContracts');
      case 'sensitiveFields':
        return t('modules.sensitiveFields');
      default:
        return t('modules.general');
    }
  };

  const getActionLabel = (actionKey: BusinessActionKey): string => {
    switch (actionKey) {
      case 'view':
        return t('actionTypes.view');
      case 'createEdit':
        return t('actionTypes.createEdit');
      case 'edit':
        return t('actionTypes.edit');
      case 'manage':
        return t('actionTypes.manage');
      case 'fullAccess':
        return t('actionTypes.fullAccess');
      default:
        return t('actionTypes.custom');
    }
  };

  const getBusinessPermissionView = (permission: RolePermission): BusinessPermissionView => {
    const catalogEntry = permissionCatalog[permission.name];
    const moduleKey = catalogEntry?.moduleKey ?? inferModuleKey(permission.module);
    const actionKey = catalogEntry?.actionKey ?? inferActionKey(permission.name);
    const fallbackSubject = permission.name.includes(':')
      ? permission.name.split(':').slice(1).join(':')
      : permission.module;

    return {
      permission,
      moduleKey,
      moduleLabel: getModuleLabel(moduleKey),
      title: catalogEntry
        ? t(`permissions.${catalogEntry.copyKey}.title`)
        : `${getActionLabel(actionKey)} ${humanizeIdentifier(fallbackSubject || permission.name)}`,
      description: catalogEntry
        ? t(`permissions.${catalogEntry.copyKey}.description`)
        : t('permissions.custom.description'),
      actionKey,
      actionLabel: getActionLabel(actionKey),
      sortOrder: catalogEntry?.sortOrder ?? 900,
    };
  };

  const selectedRole = useMemo(() => {
    return roles.find((role) => role._id === activeRoleRef) ?? roles[0] ?? null;
  }, [activeRoleRef, roles]);

  const baselineSignature = useMemo(
    () => createDraftSignature(baselineDraft),
    [baselineDraft],
  );
  const draftSignature = useMemo(
    () => createDraftSignature(draftByRole),
    [draftByRole],
  );
  const isDirty = baselineSignature !== draftSignature;

  const businessPermissions = useMemo(() => {
    return permissions
      .map((permission) => getBusinessPermissionView(permission))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return businessPermissions;

    return businessPermissions.filter((permission) => [
      permission.title,
      permission.description,
      permission.moduleLabel,
      permission.actionLabel,
      permission.permission.name,
      permission.permission.module,
    ].some((value) => value.toLowerCase().includes(keyword)));
  }, [businessPermissions, searchText]);

  const groupedPermissions = useMemo(() => {
    const grouped = filteredPermissions.reduce<Record<string, PermissionGroup>>((acc, permission) => {
      acc[permission.moduleKey] = acc[permission.moduleKey] ?? {
        moduleKey: permission.moduleKey,
        moduleLabel: permission.moduleLabel,
        permissions: [],
      };
      acc[permission.moduleKey].permissions.push(permission);
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => (
      moduleSortOrder[a.moduleKey] - moduleSortOrder[b.moduleKey]
      || a.moduleLabel.localeCompare(b.moduleLabel)
    ));
  }, [filteredPermissions]);

  const visiblePermissionRefs = useMemo(
    () => filteredPermissions.map((item) => item.permission._id),
    [filteredPermissions],
  );

  const selectedRolePermissionRefs = useMemo(
    () => selectedRole ? draftByRole[selectedRole._id] ?? [] : [],
    [draftByRole, selectedRole],
  );

  const selectedRolePermissionSet = useMemo(
    () => new Set(selectedRolePermissionRefs),
    [selectedRolePermissionRefs],
  );

  const selectedRolePermissionCount = selectedRolePermissionRefs.length;
  const completionPercent = permissions.length > 0
    ? Math.round((selectedRolePermissionCount / permissions.length) * 100)
    : 0;

  const updateRolePermission = (
    role_ref: string,
    permission_ref: string,
    checked: boolean,
  ) => {
    setDraftByRole((prev) => {
      const currentRefs = new Set(prev[role_ref] ?? []);
      if (checked) {
        currentRefs.add(permission_ref);
      } else {
        currentRefs.delete(permission_ref);
      }

      return {
        ...prev,
        [role_ref]: [...currentRefs],
      };
    });
  };

  const applyPermissionsToRole = (
    role_ref: string,
    permission_refs: string[],
    checked: boolean,
  ) => {
    setDraftByRole((prev) => {
      const currentRefs = new Set(prev[role_ref] ?? []);
      permission_refs.forEach((permission_ref) => {
        if (checked) {
          currentRefs.add(permission_ref);
        } else {
          currentRefs.delete(permission_ref);
        }
      });

      return {
        ...prev,
        [role_ref]: [...currentRefs],
      };
    });
  };

  const setPermissionForAllRoles = (permission_ref: string, checked: boolean) => {
    setDraftByRole((prev) => {
      return roles.reduce<DraftByRoleRef>((acc, role) => {
        const currentRefs = new Set(prev[role._id] ?? []);
        if (checked) {
          currentRefs.add(permission_ref);
        } else {
          currentRefs.delete(permission_ref);
        }
        acc[role._id] = [...currentRefs];
        return acc;
      }, { ...prev });
    });
  };

  const resetDraft = () => {
    setDraftByRole(baselineDraft);
  };

  const reloadData = async () => {
    const result = await fetchRolePermissions();
    if (!result.success) {
      message.error(result.message || t('messages.loadError'));
    }
  };

  const saveChanges = async () => {
    const assignments: RolePermissionAssignment[] = roles.map((role) => ({
      role_ref: role._id,
      permission_refs: draftByRole[role._id] ?? [],
    }));

    const result = await saveRolePermissions(assignments);
    if (result.success) {
      message.success(t('messages.saveSuccess'));
    } else {
      message.error(result.message || t('messages.saveError'));
    }
  };

  const renderPermissionRow = (item: BusinessPermissionView) => {
    const checked = selectedRole ? selectedRolePermissionSet.has(item.permission._id) : false;
    const appliedRoleCount = roles.filter((role) => (
      draftByRole[role._id] ?? []
    ).includes(item.permission._id)).length;

    return (
      <div
        key={item.permission._id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 0',
          borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
        }}
      >
        <Checkbox
          checked={checked}
          disabled={!selectedRole}
          onChange={(event: CheckboxChangeEvent) => {
            if (selectedRole) {
              updateRolePermission(selectedRole._id, item.permission._id, event.target.checked);
            }
          }}
          aria-label={item.title}
          style={{ marginTop: 3 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Space wrap size={[6, 6]}>
            <Text strong>{item.title}</Text>
            <Tag color={actionColorMap[item.actionKey]} style={{ marginInlineEnd: 0 }}>
              {item.actionLabel}
            </Tag>
            <Tag style={{ marginInlineEnd: 0 }}>
              {t('labels.appliedToRoles', { count: appliedRoleCount, total: roles.length })}
            </Tag>
          </Space>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary">{item.description}</Text>
          </div>
        </div>
        <Space size={4}>
          <Tooltip title={t('actions.grantPermissionToAllRoles')}>
            <Button
              aria-label={`${t('actions.grantPermissionToAllRoles')} ${item.title}`}
              icon={<TeamOutlined />}
              size="small"
              onClick={() => setPermissionForAllRoles(item.permission._id, true)}
            />
          </Tooltip>
          <Tooltip title={t('actions.clearPermissionFromAllRoles')}>
            <Button
              aria-label={`${t('actions.clearPermissionFromAllRoles')} ${item.title}`}
              danger
              icon={<StopOutlined />}
              size="small"
              onClick={() => setPermissionForAllRoles(item.permission._id, false)}
            />
          </Tooltip>
        </Space>
      </div>
    );
  };

  const collapseItems: CollapseProps['items'] = groupedPermissions.map((group) => ({
    key: group.moduleKey,
    label: (
      <Space>
        <Text strong>{group.moduleLabel}</Text>
        <Badge count={group.permissions.length} style={{ backgroundColor: token.colorPrimary }} />
      </Space>
    ),
    children: (
      <div>
        {group.permissions.map((permission) => renderPermissionRow(permission))}
      </div>
    ),
  }));

  return (
    <div style={{ backgroundColor: 'transparent', transition: 'all 0.3s ease' }}>
      <Card
        variant="borderless"
        style={{
          borderRadius: 8,
          background: isDark ? '#1e293b' : token.colorBgContainer,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: `1px solid ${isDark ? '#334155' : '#f0f0f0'}`,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <PageHeader
            title={t('title')}
            icon={<SafetyCertificateOutlined style={{ color: isDark ? '#38bdf8' : token.colorPrimary }} />}
            description={t('description')}
          />
          <Space wrap>
            <Tooltip title={t('actions.reload')}>
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={reloadData}
              />
            </Tooltip>
            <Button
              icon={<StopOutlined />}
              disabled={!isDirty || saving}
              onClick={resetDraft}
            >
              {t('actions.reset')}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!isDirty}
              loading={saving}
              onClick={saveChanges}
            >
              {t('actions.save')}
            </Button>
          </Space>
        </div>

        <section style={{ padding: 24, minWidth: 0 }}>
            {!selectedRole ? (
              <Empty description={t('empty.roles')} />
            ) : permissions.length === 0 ? (
              <Empty description={t('empty.permissions')} />
            ) : (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 280, flex: '1 1 420px' }}>
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      <Space wrap>
                        <Text strong>{t('sections.roleList')}</Text>
                        <Tag>{t('labels.roleCount', { count: roles.length })}</Tag>
                      </Space>
                      <Select
                        showSearch
                        value={selectedRole._id}
                        placeholder={t('filters.roleSearchPlaceholder')}
                        optionFilterProp="label"
                        onChange={(role_ref: string) => setActiveRoleRef(role_ref)}
                        style={{ width: 'min(420px, 100%)' }}
                        options={roles.map((role) => ({
                          value: role._id,
                          label: role.name,
                        }))}
                      />
                    </Space>
                    <Space wrap style={{ marginTop: 16 }}>
                      <Text
                        strong
                        ellipsis
                        style={{
                          display: 'block',
                          fontSize: 16,
                          maxWidth: '100%',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedRole.name}
                      </Text>
                      {isDirty && <Tag color="orange">{t('labels.unsavedChanges')}</Tag>}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <Text
                        type="secondary"
                        style={{
                          display: 'block',
                          maxWidth: 560,
                        }}
                      >
                        {selectedRole.description || t('labels.noDescription')}
                      </Text>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 280px', maxWidth: 420, minWidth: 260 }}>
                    <Progress
                      percent={completionPercent}
                      size="small"
                      status={completionPercent === 100 ? 'success' : 'active'}
                    />
                    <Text type="secondary">
                      {t('labels.assignedCount', {
                        count: selectedRolePermissionCount,
                        total: permissions.length,
                      })}
                    </Text>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <Space wrap>
                    <Tag color="blue">
                      {t('labels.visibleCount', { count: filteredPermissions.length })}
                    </Tag>
                    <Tag>
                      {t('labels.totalPermissions', { count: permissions.length })}
                    </Tag>
                  </Space>
                  <Space wrap style={{ justifyContent: 'flex-end' }}>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder={t('filters.searchPlaceholder')}
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      style={{ width: 280 }}
                    />
                    <Tooltip title={t('actions.grantVisibleRole')}>
                      <Button
                        icon={<CheckSquareOutlined />}
                        onClick={() => applyPermissionsToRole(selectedRole._id, visiblePermissionRefs, true)}
                      >
                        {t('actions.grantVisibleRole')}
                      </Button>
                    </Tooltip>
                    <Tooltip title={t('actions.clearVisibleRole')}>
                      <Button
                        danger
                        icon={<StopOutlined />}
                        onClick={() => applyPermissionsToRole(selectedRole._id, visiblePermissionRefs, false)}
                      >
                        {t('actions.clearVisibleRole')}
                      </Button>
                    </Tooltip>
                  </Space>
                </div>

                {filteredPermissions.length === 0 ? (
                  <Empty description={t('empty.search')} />
                ) : (
                  <Collapse
                    bordered={false}
                    defaultActiveKey={groupedPermissions.map((group) => group.moduleKey)}
                    items={collapseItems}
                  />
                )}
              </Space>
            )}
        </section>
      </Card>
    </div>
  );
};

export default RolePermissionMatrix;

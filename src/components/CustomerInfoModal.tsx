'use client';

import { DragEvent, useEffect, useState } from 'react';
import {
  ChevronDown,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type FieldType = 'text' | 'number' | 'dropdown';

interface CustomerField {
  id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  is_active: boolean;
  isDefault: boolean;
}

interface Props {
  isDark: boolean;
  isMobile: boolean;
  onClose: () => void;
  apiFetch: (
    url: string,
    options?: Record<string, unknown>,
  ) => Promise<{ items: CustomerField[] }>;
}

const DEFAULT_FIELDS: CustomerField[] = [
  {
    id: 'default-name',
    field_key: 'name',
    label: 'Full Name',
    field_type: 'text',
    required: true,
    options: [],
    is_active: true,
    isDefault: true,
  },
  {
    id: 'default-phone',
    field_key: 'phone',
    label: 'Phone Number',
    field_type: 'text',
    required: true,
    options: [],
    is_active: true,
    isDefault: true,
  },
  {
    id: 'default-email',
    field_key: 'email',
    label: 'Email Address',
    field_type: 'text',
    required: false,
    options: [],
    is_active: true,
    isDefault: true,
  },
];

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; help: string }[] = [
  {
    value: 'text',
    label: 'Text answer',
    help: 'Customer can type any answer.',
  },
  {
    value: 'number',
    label: 'Number',
    help: 'Customer must enter a number.',
  },
  {
    value: 'dropdown',
    label: 'Dropdown choices',
    help: 'Customer will choose one option from your list.',
  },
];

const INPUT_CLASS =
  'h-10 rounded-(--radius-control) border-gray-300 px-4 py-2 type-small text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus-visible:border-brand-300 focus-visible:ring-3 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:border-brand-800';

const SELECT_CLASS =
  'h-10 w-full appearance-none rounded-(--radius-control) border border-gray-300 bg-transparent px-4 py-2 pr-10 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800';

function slugifyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getTypeLabel(type: FieldType) {
  return (
    FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    'Text answer'
  );
}

function getTypeHelp(type: FieldType) {
  return (
    FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.help ??
    'Customer can type any answer.'
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
        {title}
      </h3>
      <p className="mt-1 type-small leading-6 text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/2">
      <span className="type-small font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

export default function CustomerInfoModal({
  onClose,
  apiFetch,
}: Props) {
  const [fields, setFields] = useState<CustomerField[]>(DEFAULT_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch('/admin/booking/customer-info', {
          auth: true,
        });

        const defaultKeys = new Set(['name', 'phone', 'email']);
        const apiDefaults = (data.items || []).filter((field) =>
          defaultKeys.has(field.field_key),
        );
        const apiCustom = (data.items || []).filter(
          (field) => !defaultKeys.has(field.field_key),
        );

        const mergedDefaults = DEFAULT_FIELDS.map((defaultField) => {
          const found = apiDefaults.find(
            (field) => field.field_key === defaultField.field_key,
          );
          return found
            ? { ...found, id: defaultField.id, isDefault: true }
            : defaultField;
        });

        setFields([
          ...mergedDefaults,
          ...apiCustom.map((field) => ({
            ...field,
            id: String(field.id ?? `custom-${field.field_key}`),
            isDefault: false,
          })),
        ]);
      } catch {
        // Keep defaults when the endpoint is unavailable.
      } finally {
        setLoading(false);
      }
    })();
  }, [apiFetch]);

  const updateField = (id: string, patch: Partial<CustomerField>) =>
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );

  const addCustomField = () =>
    setFields((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        field_key: '',
        label: '',
        field_type: 'text',
        required: false,
        options: [],
        is_active: true,
        isDefault: false,
      },
    ]);

  const removeField = (id: string) =>
    setFields((prev) => prev.filter((field) => field.id !== id));

  const addOption = (id: string) => {
    const field = fields.find((item) => item.id === id);
    updateField(id, {
      options: [...(field?.options ?? []), ''],
    });
  };

  const updateOption = (id: string, optionIndex: number, value: string) => {
    const field = fields.find((item) => item.id === id);
    const options = [...(field?.options ?? [])];
    options[optionIndex] = value;
    updateField(id, { options });
  };

  const removeOption = (id: string, optionIndex: number) => {
    const field = fields.find((item) => item.id === id);
    const options = (field?.options ?? []).filter(
      (_, index) => index !== optionIndex,
    );
    updateField(id, { options });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;

    const next = [...fields];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);

    setFields(next);
    setDragIndex(targetIndex);
  };

  const save = async () => {
    setError(null);

    for (const field of fields) {
      if (!field.isDefault) {
        if (!field.label.trim()) {
          setError(
            'Every additional question needs a question shown to the customer.',
          );
          return;
        }

        if (
          field.field_type === 'dropdown' &&
          field.options.filter((option) => option.trim()).length === 0
        ) {
          setError(
            `Dropdown question "${field.label}" needs at least one choice.`,
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const items = fields.map(
        ({ field_key, label, field_type, required, options, is_active }) => {
          const cleanLabel = label.trim();
          const cleanKey = field_key.trim()
            ? slugifyKey(field_key)
            : slugifyKey(cleanLabel);

          return {
            field_key: cleanKey,
            label: cleanLabel,
            field_type,
            required,
            options: options.map((option) => option.trim()).filter(Boolean),
            is_active,
          };
        },
      );

      await apiFetch('/admin/booking/customer-info', {
        method: 'PUT',
        body: { items },
        auth: true,
      });

      onClose();
    } catch (event: unknown) {
      setError(event instanceof Error ? event.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const defaultFields = fields.filter((field) => field.isDefault);
  const customFields = fields.filter((field) => !field.isDefault);

  return (
    <Modal
      isOpen
      onClose={onClose}
      className="m-4 max-w-215"
      showCloseButton={false}
    >
      <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-(--radius-panel) bg-white dark:bg-gray-900">
        <div className="flex items-start justify-between gap-5 border-b border-gray-100 px-6 py-5 pr-5 dark:border-gray-800">
          <div className="min-w-0">
            <Badge color="primary" startIcon={<UserCheck size={13} />}>
              Customer Info
            </Badge>
            <h2 className="mt-3 type-h4 font-bold text-gray-800 dark:text-white/90">
              Booking form fields
            </h2>
            <p className="mt-1.5 max-w-2xl type-small leading-6 text-gray-500 dark:text-gray-400">
              These questions are collected after a booking is confirmed. Name
              and phone are always required.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Close customer info fields"
          >
            <X size={18} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center type-small text-gray-500 dark:text-gray-400">
              Loading fields...
            </div>
          ) : (
            <div className="space-y-6">
              <section className="space-y-4">
                <SectionHeader
                  title="Required customer details"
                  description="These core fields stay available for every confirmed booking."
                />

                <div className="grid gap-3">
                  {defaultFields.map((field) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/2 md:grid-cols-[1fr_1fr_auto]"
                    >
                      <div>
                        <p className="type-caption font-medium text-gray-500 dark:text-gray-400">
                          Field
                        </p>
                        <p className="mt-1 type-small font-semibold text-gray-800 dark:text-white/90">
                          {field.label}
                        </p>
                      </div>

                      <div>
                        <p className="type-caption font-medium text-gray-500 dark:text-gray-400">
                          Answer type
                        </p>
                        <p className="mt-1 type-small font-semibold text-gray-800 dark:text-white/90">
                          {getTypeLabel(field.field_type)}
                        </p>
                      </div>

                      <ToggleRow
                        label={field.required ? 'Required' : 'Optional'}
                        checked={field.required}
                        disabled={field.field_key === 'name' || field.field_key === 'phone'}
                        onChange={(checked) =>
                          updateField(field.id, { required: checked })
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionHeader
                    title="Additional questions"
                    description="Add optional booking questions such as service type, budget, or notes."
                  />
                  <Button onClick={addCustomField}>
                    <Plus size={16} />
                    Add question
                  </Button>
                </div>

                {customFields.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center dark:border-gray-800 dark:bg-white/2">
                    <h4 className="type-small font-semibold text-gray-800 dark:text-white/90">
                      No additional questions yet
                    </h4>
                    <p className="mx-auto mt-1 max-w-md type-small leading-6 text-gray-500 dark:text-gray-400">
                      Add fields only when your booking flow needs more customer
                      context.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customFields.map((field) => {
                      const fieldIndex = fields.findIndex(
                        (item) => item.id === field.id,
                      );
                      const cleanOptions = field.options.filter((option) =>
                        option.trim(),
                      );

                      return (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={() => handleDragStart(fieldIndex)}
                          onDragOver={(event) =>
                            handleDragOver(event, fieldIndex)
                          }
                          onDragEnd={() => setDragIndex(null)}
                          className={cn(
                            'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3',
                            dragIndex === fieldIndex &&
                              'border-brand-300 dark:border-brand-700',
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                            <div className="flex min-w-0 items-center gap-3">
                              <button
                                type="button"
                                className="flex h-9 w-9 cursor-grab items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-400 dark:border-gray-800 dark:bg-gray-900"
                                aria-label="Drag field"
                              >
                                <GripVertical size={16} />
                              </button>
                              <div className="min-w-0">
                                <p className="truncate type-small font-semibold text-gray-800 dark:text-white/90">
                                  {field.label || 'Untitled question'}
                                </p>
                                <p className="mt-0.5 type-caption text-gray-500 dark:text-gray-400">
                                  {getTypeLabel(field.field_type)}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeField(field.id)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-error-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-white/3 dark:hover:text-error-400"
                              aria-label="Remove field"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="space-y-5 p-4 sm:p-6">
                            <div>
                              <Label>Question shown to customer</Label>
                              <Input
                                className={INPUT_CLASS}
                                placeholder="e.g. Which service do you need?"
                                value={field.label}
                                onChange={(event) => {
                                  const nextLabel = event.target.value;
                                  updateField(field.id, {
                                    label: nextLabel,
                                    field_key: field.field_key.trim()
                                      ? field.field_key
                                      : slugifyKey(nextLabel),
                                  });
                                }}
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
                              <div>
                                <Label>Answer type</Label>
                                <div className="relative">
                                  <select
                                    value={field.field_type}
                                    onChange={(event) =>
                                      updateField(field.id, {
                                        field_type: event.target
                                          .value as FieldType,
                                        options:
                                          event.target.value === 'dropdown'
                                            ? field.options
                                            : [],
                                      })
                                    }
                                    className={SELECT_CLASS}
                                  >
                                    {FIELD_TYPE_OPTIONS.map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                        className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown
                                    size={16}
                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                  />
                                </div>
                                <p className="mt-1.5 type-small text-gray-500 dark:text-gray-400">
                                  {getTypeHelp(field.field_type)}
                                </p>
                              </div>

                              <div className="grid gap-3">
                                <ToggleRow
                                  label="Required question"
                                  checked={field.required}
                                  onChange={(checked) =>
                                    updateField(field.id, {
                                      required: checked,
                                    })
                                  }
                                />
                                <ToggleRow
                                  label="Active for bookings"
                                  checked={field.is_active}
                                  onChange={(checked) =>
                                    updateField(field.id, {
                                      is_active: checked,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {field.field_type === 'dropdown' && (
                              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/2">
                                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div>
                                    <h4 className="type-small font-semibold text-gray-800 dark:text-white/90">
                                      Dropdown choices
                                    </h4>
                                    <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
                                      Add the options customers can select.
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOption(field.id)}
                                  >
                                    <Plus size={14} />
                                    Add choice
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  {field.options.map((option, optionIndex) => (
                                    <div
                                      key={`${field.id}-${optionIndex}`}
                                      className="grid grid-cols-[32px_1fr_40px] items-center gap-2"
                                    >
                                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white type-caption font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-800">
                                        {optionIndex + 1}
                                      </span>
                                      <Input
                                        className={INPUT_CLASS}
                                        placeholder={`Choice ${optionIndex + 1}`}
                                        value={option}
                                        onChange={(event) =>
                                          updateOption(
                                            field.id,
                                            optionIndex,
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeOption(field.id, optionIndex)
                                        }
                                        className="flex h-10 w-10 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-error-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-white/3"
                                        aria-label="Remove choice"
                                      >
                                        <X size={15} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/2">
                              <p className="type-caption font-medium text-gray-500 dark:text-gray-400">
                                Customer preview
                              </p>
                              <p className="mt-2 type-small font-semibold text-gray-800 dark:text-white/90">
                                {field.label || 'Your question will appear here'}
                              </p>

                              {field.field_type === 'dropdown' ? (
                                cleanOptions.length > 0 ? (
                                  <div className="mt-3 grid gap-2">
                                    {cleanOptions.map((option, optionIndex) => (
                                      <div
                                        key={`${option}-${optionIndex}`}
                                        className="rounded-(--radius-control) border border-gray-200 bg-white px-3 py-2 type-small text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                                      >
                                        {optionIndex + 1}. {option}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 type-small text-gray-500 dark:text-gray-400">
                                    Dropdown choices will appear here.
                                  </p>
                                )
                              ) : (
                                <div className="mt-3 rounded-(--radius-control) border border-dashed border-gray-300 bg-white px-3 py-2 type-small text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                                  {field.field_type === 'number'
                                    ? 'Customer will enter a number.'
                                    : 'Customer will type an answer.'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {error && (
                <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 type-small font-medium text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save fields'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

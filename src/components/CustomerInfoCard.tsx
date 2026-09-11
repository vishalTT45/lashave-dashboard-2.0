import { UserCheck } from "lucide-react";

import { SettingsActionRow } from "@/components/settings/SettingsActionRow";

interface Props {
  fieldCount?: number;
  onOpen: () => void;
}

export default function CustomerInfoCard({ fieldCount, onOpen }: Props) {
  return (
    <SettingsActionRow
      icon={<UserCheck size={28} />}
      iconColorClass="bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
      title="Customer Info Fields"
      description="Configure what information to collect from customers after a booking is confirmed."
      actionLabel="Configure"
      actionColorClass="bg-brand-50 text-brand-500 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25"
      onAction={onOpen}
      onRowClick={onOpen}
      meta={
        fieldCount !== undefined ? (
          <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 type-caption font-medium text-gray-700 dark:bg-white/5 dark:text-white/80">
            {fieldCount} field{fieldCount !== 1 ? "s" : ""} configured
          </span>
        ) : null
      }
    >
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {["Name", "Phone", "Email"].map((field) => (
          <div
            key={field}
            className="rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/2"
          >
            <div className="type-caption font-medium text-gray-500 dark:text-gray-400">
              Field
            </div>
            <div className="mt-1 type-small font-semibold text-gray-800 dark:text-white/90">
              {field}
            </div>
          </div>
        ))}
      </div>
    </SettingsActionRow>
  );
}

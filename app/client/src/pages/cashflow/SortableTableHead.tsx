import { ArrowDown, ArrowUp } from 'lucide-react';
import { TableHead } from '@databricks/appkit-ui/react';

export function SortableTableHead<Key extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: Key;
  activeKey: Key;
  direction: 'asc' | 'desc';
  onSort: (key: Key) => void;
  align?: 'left' | 'right';
}) {
  const icon =
    activeKey === sortKey ? (
      direction === 'asc' ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )
    ) : null;

  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 font-medium ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {label} {icon}
      </button>
    </TableHead>
  );
}

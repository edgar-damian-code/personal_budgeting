import { ChevronDown } from 'lucide-react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@databricks/appkit-ui/react';

export function GroupsSlicer({
  groups,
  excluded,
  onToggle,
}: {
  groups: string[];
  excluded: Set<string>;
  onToggle: (group: string) => void;
}) {
  const includedCount = groups.length - excluded.size;
  const label = excluded.size === 0 ? 'All' : `${includedCount} of ${groups.length}`;

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <span className="text-muted-foreground text-xs font-normal">Groups</span>
            <span>{label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Filter by group</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {groups.map((group) => (
            <DropdownMenuCheckboxItem
              key={group}
              checked={!excluded.has(group)}
              onCheckedChange={() => onToggle(group)}
              onSelect={(e) => e.preventDefault()}
            >
              {group}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {excluded.size > 0 && (
        <Badge variant="outline" className="text-destructive border-destructive/30 font-normal">
          Excluding: {[...excluded].join(', ')} · applies to whole page
        </Badge>
      )}
    </div>
  );
}

import { Construction } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@databricks/appkit-ui/react';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="max-w-6xl mx-auto">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Construction />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>This tab is coming soon.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

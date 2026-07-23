import { Button } from '@databricks/appkit-ui/react';
import { Eye, EyeOff } from 'lucide-react';
import { useDemoMode } from '../lib/demoMode';

// Header toggle for demo mode. When on, the button goes solid (primary) so it is
// obvious at a glance that sample figures are being shown rather than real data.
export function DemoToggle() {
  const { demoMode, toggleDemoMode } = useDemoMode();

  return (
    <Button
      variant={demoMode ? 'default' : 'ghost'}
      size="sm"
      onClick={toggleDemoMode}
      aria-pressed={demoMode}
      title={
        demoMode
          ? 'Demo mode on — showing sample data'
          : 'Demo mode off — showing your real data'
      }
    >
      {demoMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      <span className="ml-1.5 hidden sm:inline">{demoMode ? 'Demo on' : 'Demo'}</span>
    </Button>
  );
}

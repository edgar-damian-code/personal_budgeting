import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@databricks/appkit-ui/react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a light/dark icon mismatch on first paint before the theme is resolved client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle dark mode"
    >
      {mounted && resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      <span className="sr-only">Toggle dark mode</span>
    </Button>
  );
}

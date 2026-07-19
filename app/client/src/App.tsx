import { createBrowserRouter, RouterProvider, NavLink, Outlet } from 'react-router';
import { useState } from 'react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { Menu } from 'lucide-react';
import { CashFlowPage } from './pages/cashflow/CashFlowPage';
import { BudgetPage } from './pages/budget/BudgetPage';
import { CreditCardsPage } from './pages/creditcards/CreditCardsPage';
import { SpendAnalysisPage } from './pages/spend/SpendAnalysisPage';
import { ThemeToggle } from './components/ThemeToggle';

// House of Damian crest — inherits currentColor so it adapts to light/dark via text-*.
function HodCrest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 122" fill="none" stroke="currentColor" className={className} aria-hidden>
      <path
        d="M50 5 L91 19 L91 60 C91 90 72 108 50 117 C28 108 9 90 9 60 L9 19 Z"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <line x1="20" y1="44" x2="80" y2="44" strokeWidth="1.4" opacity="0.45" />
      <path d="M50 20 L54 27 L50 34 L46 27 Z" fill="currentColor" stroke="none" />
      <rect x="33" y="76" width="8" height="14" rx="2" fill="currentColor" stroke="none" opacity="0.5" />
      <rect x="46" y="66" width="8" height="24" rx="2" fill="currentColor" stroke="none" opacity="0.75" />
      <rect x="59" y="56" width="8" height="34" rx="2" fill="currentColor" stroke="none" />
      <path d="M35 72 L50 62 L65 51" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="65" cy="51" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

type NavLinkClassFn = (props: { isActive: boolean }) => string;

const TABS = [
  { to: '/', label: 'Cash Flow', end: true },
  { to: '/credit-cards', label: 'Credit Cards', end: false },
  { to: '/budget', label: 'Budget vs Actual', end: false },
  { to: '/spend', label: 'Spend Analysis', end: false },
];

function NavLinks({ className, linkClass, onClick }: { className?: string; linkClass: NavLinkClassFn; onClick?: () => void }) {
  return (
    <nav className={className}>
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={linkClass} onClick={onClick}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Layout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-4 md:px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <HodCrest className="h-7 w-7 text-primary" />
          <span className="hidden text-base font-bold tracking-wide text-foreground sm:inline">
            HOUSE OF <span className="text-primary">DAMIAN</span>
          </span>
        </div>
        {/* Desktop nav — hidden below md breakpoint */}
        <NavLinks className="hidden md:flex gap-1" linkClass={navLinkClass} />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {/* Mobile nav — visible below md breakpoint */}
          <div className="md:hidden">
            <Sheet open={mobileNavOpen && isMobile} onOpenChange={setMobileNavOpen}>
              <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <NavLinks className="flex flex-col gap-1" linkClass={mobileNavLinkClass} onClick={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <CashFlowPage /> },
      { path: '/credit-cards', element: <CreditCardsPage /> },
      { path: '/budget', element: <BudgetPage /> },
      { path: '/spend', element: <SpendAnalysisPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

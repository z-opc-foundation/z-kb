import type { ComponentType, LazyExoticComponent } from 'react';
import AppShell from '@/components/app-shell';

export function withAppShell(Page: ComponentType | LazyExoticComponent<ComponentType>) {
  return function AppShellPage() {
    return (
      <AppShell>
        <Page />
      </AppShell>
    );
  };
}

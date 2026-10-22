'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LogoutButton({ label, className }: { label: string; className?: string }) {
  return (
    <Button
      variant="ghost"
      className={`border border-white/20 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground dark:hover:bg-white/10 ${className ?? ''}`} onClick={() => signOut({ callbackUrl: '/login' })}>
      {label}
    </Button>
  );
}

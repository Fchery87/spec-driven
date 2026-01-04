'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, 
  Settings, 
  Users, 
  Cpu, 
  LayoutDashboard,
  FolderOpen,
  ChevronLeft,
  Plug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'super_admin';
}

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/llm', label: 'LLM Config', icon: Cpu },
  { href: '/admin/mcp', label: 'MCP Config', icon: Plug },
  { href: '/admin/features', label: 'Features', icon: Settings },
  { href: '/admin/projects', label: 'All Projects', icon: FolderOpen },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Use database-backed admin check to ensure fresh role data
        const response = await fetch('/api/auth/check-admin');
        const data = await response.json();
        
        if (!data.success || !data.isAdmin) {
          router.push('/dashboard');
          return;
        }

        // Get user info from session for display
        const sessionResponse = await fetch('/api/auth/get-session');
        const session = await sessionResponse.json();
        
        if (session?.user) {
          setUser({
            ...session.user,
            role: data.role,
          });
        }
      } catch {
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="flex">
        {/* Admin Sidebar */}
        <aside className="w-64 min-h-screen border-r border-border bg-card/50 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-6 px-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">Admin Portal</span>
          </div>

          <nav className="space-y-1 flex-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || 
                (item.href !== '/admin' && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border pt-4 mt-4">
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-primary capitalize">{user.role.replace('_', ' ')}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => router.push('/dashboard')}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

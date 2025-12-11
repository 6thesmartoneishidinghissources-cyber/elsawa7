import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Car, Info } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

export function Header() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getRoleBadge = () => {
    switch (profile?.role) {
      case 'admin':
        return 'نسخة السوّاح';
      case 'driver':
        return 'سوّاق';
      case 'passenger':
        return 'راكب';
      default:
        return '';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <Car className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold text-foreground">ElSawa7</span>
        </div>
        
        <div className="flex items-center gap-4">
          <PWAInstallPrompt />
          
          <Link to="/about">
            <Button variant="ghost" size="sm">
              <Info className="h-4 w-4 ml-1" />
              <span className="hidden sm:inline">عن التطبيق</span>
            </Button>
          </Link>

          {profile && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground hidden sm:inline">{profile.name}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {getRoleBadge()}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 ml-2" />
                <span className="hidden sm:inline">خروج</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
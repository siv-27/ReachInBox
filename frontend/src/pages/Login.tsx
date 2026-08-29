import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button/Button';
import { SendHorizontal } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF7ED] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[#FFFFFF] p-8 rounded-xl shadow-sm border border-[#E7E0D8] text-center">
        <div>
          <div className="w-12 h-12 bg-[#FFEDD5] rounded-xl flex items-center justify-center mx-auto mb-4 border border-[#FFEDD5]">
            <SendHorizontal className="w-6 h-6 text-[#C2410C]" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-[#292524] tracking-tight">
            Reach<span className="text-[#C2410C]">Inbox</span> Scheduler
          </h2>
          <p className="mt-2 text-sm text-[#78716C]">
            Sign in to manage and schedule your email outreach campaigns
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <Button
            onClick={login}
            variant="outline"
            size="lg"
            className="w-full py-3 hover:bg-[#FFF7ED] transition-all cursor-pointer flex items-center justify-center gap-3 border-[#E7E0D8]"
            leftIcon={
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            }
          >
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}

import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthRedirectGuard } from '@/components/auth/auth-redirect-guard';
import { SignInForm } from '@/components/auth/sign-in-form';

export const dynamic = 'force-dynamic';

export default function AuthRequiredPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextQuery = searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : '';

  return (
    <AuthRedirectGuard>
      <AuthLayout
        title="TeamWork"
        subtitle="Sign in to your account"
        helperText="Don't have an account?"
        helperHref={`/sign-up${nextQuery}`}
        helperLabel="Sign up"
      >
        <SignInForm />
      </AuthLayout>
    </AuthRedirectGuard>
  );
}

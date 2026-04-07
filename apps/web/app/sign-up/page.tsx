import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthRedirectGuard } from '@/components/auth/auth-redirect-guard';
import { SignUpForm } from '@/components/auth/sign-up-form';

export const dynamic = 'force-dynamic';

export default function SignUpPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const nextQuery = searchParams?.next ? `?next=${encodeURIComponent(searchParams.next)}` : '';

  return (
    <AuthRedirectGuard>
      <AuthLayout
        title="TeamWork"
        subtitle="Create your account"
        helperText="Already have an account?"
        helperHref={`/auth-required${nextQuery}`}
        helperLabel="Sign in"
      >
        <SignUpForm />
      </AuthLayout>
    </AuthRedirectGuard>
  );
}

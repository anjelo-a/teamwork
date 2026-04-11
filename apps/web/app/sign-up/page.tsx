import { AuthLayout } from '@/components/auth/auth-layout';
import { AuthRedirectGuard } from '@/components/auth/auth-redirect-guard';
import { SignUpForm } from '@/components/auth/sign-up-form';

export const dynamic = 'force-dynamic';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextQuery = resolvedSearchParams?.next
    ? `?next=${encodeURIComponent(resolvedSearchParams.next)}`
    : '';

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

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { ApiClientError } from '@/services/apiClient';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { useAuth } from '../hooks/useAuth';
import { registerFormSchema } from '../validation/authSchemas';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    const parsed = registerFormSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name: flattened.name?.[0],
        email: flattened.email?.[0],
        password: flattened.password?.[0],
        confirmPassword: flattened.confirmPassword?.[0],
      });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      await register({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      setSuccessMessage('Account created. Redirecting to your CloudForge workspace...');
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'EMAIL_EXISTS') {
        setFieldErrors((prev) => ({
          ...prev,
          email: 'An account with this email already exists',
        }));
      }
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Unable to register right now. Please try again.';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your CloudForge account"
      subtitle="Start building and organizing AWS architectures in a secure workspace."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-sky-400 hover:text-sky-300">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{serverError}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        <FormField
          id="register-name"
          label="Full Name"
          type="text"
          autoComplete="name"
          placeholder="Alex Morgan"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
          }}
          error={fieldErrors.name}
        />

        <FormField
          id="register-email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="architect@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={fieldErrors.email}
        />

        <div className="space-y-2.5">
          <FormField
            id="register-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
            enablePasswordToggle
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <FormField
          id="register-confirm-password"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirmPassword) {
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }
          }}
          error={fieldErrors.confirmPassword}
          enablePasswordToggle
        />

        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          className="mt-2 h-10 w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

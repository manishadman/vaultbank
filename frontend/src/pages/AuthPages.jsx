import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { DemoBanner, Field, inputClass, Button } from '../components/ui.jsx';
import { loginSchema, registerSchema } from '../lib/schemas.js';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

function AuthCard({ title, children }) {
  return (
    <div className="mx-auto max-w-md px-4 pb-16">
      <DemoBanner />
      <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
      <div className="mt-6 rounded-3xl bg-white p-6 shadow-card dark:bg-ink-900">{children}</div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState, setError } = useForm({ resolver: zodResolver(loginSchema) });
  async function onSubmit(values) {
    try {
      const user = await login(values);
      navigate(user.role === 'ADMIN' ? '/admin' : '/app');
    } catch (error) {
      setError('root', { message: errorMessage(error, 'Sign-in failed.') });
    }
  }
  return (
    <AuthCard title="Sign in">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Email" error={formState.errors.email?.message}>
          <input className={inputClass} type="email" autoComplete="username" {...register('email')} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          <input className={inputClass} type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        {formState.errors.root ? <p className="text-sm text-red-700">{formState.errors.root.message}</p> : null}
        <Button type="submit" disabled={formState.isSubmitting} className="w-full">Sign in</Button>
      </form>
      <p className="mt-4 text-sm">New here? <Link to="/register" className="font-semibold">Create a profile</Link></p>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState, setError } = useForm({ resolver: zodResolver(registerSchema) });
  async function onSubmit(values) {
    try {
      await signUp(values);
      navigate('/app');
    } catch (error) {
      setError('root', { message: errorMessage(error, 'Registration failed.') });
    }
  }
  return (
    <AuthCard title="Open a simulated profile">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Full name" error={formState.errors.fullName?.message}>
          <input className={inputClass} autoComplete="name" {...register('fullName')} />
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          <input className={inputClass} type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          <input className={inputClass} type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label="Confirm password" error={formState.errors.confirmPassword?.message}>
          <input className={inputClass} type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </Field>
        {formState.errors.root ? <p className="text-sm text-red-700">{formState.errors.root.message}</p> : null}
        <Button type="submit" disabled={formState.isSubmitting} className="w-full">Create profile</Button>
      </form>
    </AuthCard>
  );
}

export function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <DemoBanner />
      <h1 className="mt-6 text-4xl font-semibold">How the demonstration works</h1>
      <div className="mt-6 space-y-4 text-ink-800/80 dark:text-white/75">
        <p>Register a customer profile, or sign in with the development seed accounts after running the seed script. The administrator cannot be created from this page.</p>
        <p>Deposits draw from an internal simulation clearing account. Withdrawals return funds there. Transfers move balances between customer accounts. Every completed movement keeps the ledger balanced.</p>
        <p>Savings interest accrues daily with an Actual/365 convention and posts whole cents at month end. The calculator is an estimate and does not credit your account.</p>
        <p>Development passwords are printed by the seed command and documented in the README. Change them before any shared deployment.</p>
      </div>
    </div>
  );
}

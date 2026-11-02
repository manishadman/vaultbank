import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api.js';
import { passwordSchema } from '../lib/schemas.js';
import { Button, Card, Field, inputClass } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { register, handleSubmit, formState } = useForm({ defaultValues: { fullName: user?.fullName || '' } });
  async function onSubmit(values) {
    try {
      const response = await api.patch('/profile', values);
      setUser(response.data.user);
      toast.push('Profile updated.');
    } catch (error) {
      toast.push(errorMessage(error), 'error');
    }
  }
  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-1 text-sm">{user?.email}</p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Full name" error={formState.errors.fullName?.message}>
          <input className={inputClass} {...register('fullName', { required: 'Enter your name.', minLength: 2 })} />
        </Field>
        <Button type="submit">Save</Button>
      </form>
    </Card>
  );
}

export function SecurityPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const schema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  }).refine((value) => value.newPassword === value.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
  const { register, handleSubmit, formState, setError } = useForm({ resolver: zodResolver(schema) });
  async function onSubmit(values) {
    try {
      await api.post('/profile/password', values);
      toast.push('Password changed. Sign in again.');
      await logout();
      navigate('/login');
    } catch (error) {
      setError('root', { message: errorMessage(error) });
    }
  }
  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">Security</h1>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Current password" error={formState.errors.currentPassword?.message}><input type="password" className={inputClass} {...register('currentPassword')} /></Field>
        <Field label="New password" error={formState.errors.newPassword?.message}><input type="password" className={inputClass} {...register('newPassword')} /></Field>
        <Field label="Confirm new password" error={formState.errors.confirmPassword?.message}><input type="password" className={inputClass} {...register('confirmPassword')} /></Field>
        {formState.errors.root ? <p className="text-sm text-red-700">{formState.errors.root.message}</p> : null}
        <Button type="submit">Change password</Button>
      </form>
    </Card>
  );
}

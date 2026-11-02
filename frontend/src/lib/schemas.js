import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a digit.')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol.');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name.'),
    email: z.string().trim().email('Enter a valid email.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const amountSchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, 'Enter a positive amount like 25.00.')
  .refine((value) => value !== '0' && value !== '0.0' && value !== '0.00', 'Amount must be greater than zero.');

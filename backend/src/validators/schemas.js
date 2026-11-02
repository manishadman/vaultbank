import { z } from 'zod';

const password = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a digit.')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol.');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(160),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const openAccountSchema = z.object({
  accountType: z.enum(['CHECKING', 'SAVINGS']),
  name: z.string().trim().min(2).max(40),
});

const money = z.string().trim().min(1).max(16);

export const depositSchema = z.object({
  accountId: z.string().min(1),
  amount: money,
  description: z.string().trim().max(140).optional(),
});

export const withdrawSchema = depositSchema;

export const transferSchema = z.object({
  sourceAccountId: z.string().min(1),
  destinationAccountNumber: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit account number.'),
  amount: money,
  description: z.string().trim().max(140).optional(),
});

export const projectionSchema = z.object({
  initialDeposit: money,
  monthlyContribution: z.string().trim().max(16).optional(),
  annualInterestRateBps: z.number().int().min(0).max(2000),
  years: z.number().int().min(1).max(40),
});

export const rateSchema = z.object({
  annualInterestRateBps: z.number().int().min(0).max(2000),
  note: z.string().trim().max(200).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'INTEREST']).optional(),
  status: z.enum(['COMPLETED', 'FAILED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['date', 'amount']).default('date'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

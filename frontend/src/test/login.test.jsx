import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../pages/AuthPages.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';

vi.mock('../services/api.js', () => ({
  api: {
    post: vi.fn(() => Promise.reject({ response: { data: { error: { message: 'Invalid email or password.' } } } })),
  },
  setAccessToken: vi.fn(),
  errorMessage: (error, fallback) => error?.response?.data?.error?.message || fallback,
}));

describe('login page', () => {
  it('shows validation and an authentication error', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'ada@example.com');
    await user.type(document.querySelector('input[name="password"]'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
  });
});

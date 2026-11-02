import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { PublicLayout, Shell } from './layouts/Shell.jsx';
import { LandingPage } from './pages/PublicPages.jsx';
import { DemoPage, LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { AccountDetailPage, AccountsPage } from './pages/AccountPages.jsx';
import { DepositPage, TransferPage, WithdrawPage } from './pages/MovePages.jsx';
import { TransactionDetailPage, TransactionsPage } from './pages/TransactionPages.jsx';
import { CalculatorPage, SavingsPage } from './pages/SavingsPages.jsx';
import { ProfilePage, SecurityPage } from './pages/SettingsPages.jsx';
import { AdminAccountsPage, AdminCustomersPage, AdminDashboardPage, AdminInterestPage, AuditPage, CustomerDetailPage, MonitorPage } from './pages/AdminPages.jsx';
import { ErrorPage, NotFoundPage, UnauthorizedPage } from './pages/StatusPages.jsx';

function Gate({ role, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="p-8 text-sm">Restoring your session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/unauthorized" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
      <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
      <Route path="/register" element={<PublicLayout><RegisterPage /></PublicLayout>} />
      <Route path="/demo" element={<PublicLayout><DemoPage /></PublicLayout>} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/maintenance" element={<ErrorPage />} />
      <Route path="/app" element={<Gate role="CUSTOMER"><Shell /></Gate>}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:id" element={<AccountDetailPage />} />
        <Route path="deposit" element={<DepositPage />} />
        <Route path="withdraw" element={<WithdrawPage />} />
        <Route path="transfer" element={<TransferPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/:id" element={<TransactionDetailPage />} />
        <Route path="savings" element={<SavingsPage />} />
        <Route path="savings/calculator" element={<CalculatorPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="security" element={<SecurityPage />} />
      </Route>
      <Route path="/admin" element={<Gate role="ADMIN"><Shell /></Gate>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="accounts" element={<AdminAccountsPage />} />
        <Route path="transactions" element={<MonitorPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="interest" element={<AdminInterestPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

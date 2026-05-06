import { AppProvider, useAppContext } from '@/context/AppContext';

import Header from '@/components/Header';
import EmptyState from '@/components/EmptyState';
import DashboardSection from '@/components/DashboardSection';
import BalanceSection from '@/components/BalanceSection';
import ReportSection from '@/components/ReportSection';
import DataTableSection from '@/components/DataTableSection';
import AdminSection from '@/components/AdminSection';
import CallPlanSection from '@/components/CallPlanSection';
import LoaderOverlay from '@/components/LoaderOverlay';

function DashboardContent() {
  const { hasData, activeTab, isLoading } = useAppContext();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {isLoading && <LoaderOverlay />}
      <Header />
      <main className="container mx-auto p-4 md:p-6 flex-1 overflow-y-auto custom-scroll relative">
        {!hasData && <EmptyState />}
        {hasData && activeTab === 'dashboard' && <DashboardSection type="SUPERVISOR" />}
        {hasData && activeTab === 'ejecutivos' && <DashboardSection type="EJECUTIVO" />}
        {hasData && activeTab === 'ejecutivos2' && <DashboardSection type="EJECUTIVO_PENDIENTE" />}
        {activeTab === 'plan' && <CallPlanSection />}
        {hasData && activeTab === 'balance' && <BalanceSection />}
        {hasData && activeTab === 'report' && <ReportSection />}
        {hasData && activeTab === 'datos' && <DataTableSection />}
        {activeTab === 'admin' && <AdminSection />}
      </main>
    </div>
  );
}

export default function Index() {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  );
}

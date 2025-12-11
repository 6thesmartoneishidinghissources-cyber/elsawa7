import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingPayments } from './PendingPayments';
import { DriversManagement } from './DriversManagement';
import { CarsManagement } from './CarsManagement';
import { AllReservations } from './AllReservations';
import { QReports } from './QReports';
import { CreditCard, Users, Car, Ticket, AlertTriangle } from 'lucide-react';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">الحوالات</span>
          </TabsTrigger>
          <TabsTrigger value="reservations" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            <span className="hidden sm:inline">الحجوزات</span>
          </TabsTrigger>
          <TabsTrigger value="drivers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">السوّاقين</span>
          </TabsTrigger>
          <TabsTrigger value="cars" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">السيارات</span>
          </TabsTrigger>
          <TabsTrigger value="qreports" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Q Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PendingPayments />
        </TabsContent>

        <TabsContent value="reservations">
          <AllReservations />
        </TabsContent>

        <TabsContent value="drivers">
          <DriversManagement />
        </TabsContent>

        <TabsContent value="cars">
          <CarsManagement />
        </TabsContent>

        <TabsContent value="qreports">
          <QReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}
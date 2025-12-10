import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingPayments } from './PendingPayments';
import { DriversManagement } from './DriversManagement';
import { CarsManagement } from './CarsManagement';
import { AllReservations } from './AllReservations';
import { CreditCard, Users, Car, Ticket } from 'lucide-react';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
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
      </Tabs>
    </div>
  );
}

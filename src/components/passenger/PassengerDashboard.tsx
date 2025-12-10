import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Car, Reservation } from '@/lib/types';
import { CarCard } from './CarCard';
import { BookingModal } from './BookingModal';
import { MyReservation } from './MyReservation';
import { QueueView } from './QueueView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Car as CarIcon, Ticket } from 'lucide-react';

export function PassengerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [myReservation, setMyReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const fetchCars = async () => {
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate available seats for each car
      const carsWithSeats = await Promise.all(
        (data || []).map(async (car) => {
          const { count } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('car_id', car.id)
            .in('status', ['temporary', 'confirmed']);
          
          return {
            ...car,
            available_seats: car.capacity - (count || 0),
          } as Car;
        })
      );

      setCars(carsWithSeats);
    } catch (error) {
      console.error('Error fetching cars:', error);
      toast({
        title: 'خطأ',
        description: 'حصل خطأ في تحميل السيارات',
        variant: 'destructive',
      });
    }
  };

  const fetchMyReservation = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          cars (*)
        `)
        .eq('passenger_id', user.id)
        .in('status', ['temporary', 'confirmed'])
        .maybeSingle();

      if (error) throw error;
      setMyReservation(data as Reservation | null);
    } catch (error) {
      console.error('Error fetching reservation:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCars(), fetchMyReservation()]);
      setLoading(false);
    };

    loadData();

    // Subscribe to reservation changes
    const channel = supabase
      .channel('passenger-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `passenger_id=eq.${user?.id}`,
        },
        () => {
          fetchMyReservation();
          fetchCars();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleBookCar = (car: Car) => {
    if (myReservation) {
      toast({
        title: 'معذرة',
        description: 'عندك حجز شغّال بالفعل',
        variant: 'destructive',
      });
      return;
    }
    if (car.available_seats === 0) {
      toast({
        title: 'معذرة',
        description: 'السيارة ممتلئة',
        variant: 'destructive',
      });
      return;
    }
    setSelectedCar(car);
    setShowBookingModal(true);
  };

  const handleBookingComplete = () => {
    setShowBookingModal(false);
    setSelectedCar(null);
    fetchMyReservation();
    fetchCars();
  };

  const handleCancelReservation = async () => {
    if (!myReservation) return;

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', myReservation.id);

      if (error) throw error;

      toast({
        title: 'تم',
        description: 'تم إلغاء الحجز',
      });
      setMyReservation(null);
      fetchCars();
    } catch (error) {
      console.error('Error canceling reservation:', error);
      toast({
        title: 'خطأ',
        description: 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Reservation */}
      {myReservation && (
        <MyReservation 
          reservation={myReservation} 
          onCancel={handleCancelReservation}
        />
      )}

      {/* Available Cars */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CarIcon className="h-5 w-5 text-primary" />
            السيارات المتاحة
          </CardTitle>
          <CardDescription>اختر سيارة واحجز مقعدك</CardDescription>
        </CardHeader>
        <CardContent>
          {cars.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              لا توجد سيارات متاحة حالياً
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  onBook={() => handleBookCar(car)}
                  disabled={!!myReservation}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue View */}
      {myReservation?.car_id && (
        <QueueView carId={myReservation.car_id} role="passenger" />
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedCar && (
        <BookingModal
          car={selectedCar}
          open={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          onComplete={handleBookingComplete}
        />
      )}
    </div>
  );
}

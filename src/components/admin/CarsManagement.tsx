import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Car, Driver } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Car as CarIcon, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DriverWithProfile {
  id: string;
  status: string;
  profiles: {
    name: string;
  } | null;
}

export function CarsManagement() {
  const { toast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [drivers, setDrivers] = useState<DriverWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newCar, setNewCar] = useState({
    title: '',
    route: '',
    capacity: 14,
    driver_id: '',
  });

  const fetchData = async () => {
    try {
      const [carsRes, driversRes] = await Promise.all([
        supabase.from('cars').select('*').order('created_at', { ascending: false }),
        supabase.from('drivers').select(`*, profiles:id (name)`).eq('status', 'approved'),
      ]);

      if (carsRes.error) throw carsRes.error;
      if (driversRes.error) throw driversRes.error;

      setCars(carsRes.data as Car[]);
      setDrivers((driversRes.data as any[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCar = async () => {
    if (!newCar.title) {
      toast({
        title: 'خطأ',
        description: 'اسم السيارة مطلوب',
        variant: 'destructive',
      });
      return;
    }

    setAdding(true);

    try {
      const { error } = await supabase.from('cars').insert({
        title: newCar.title,
        route: newCar.route || null,
        capacity: newCar.capacity,
        driver_id: newCar.driver_id || null,
      });

      if (error) throw error;

      toast({
        title: 'تم',
        description: 'تم إضافة السيارة بنجاح',
      });

      setShowAddDialog(false);
      setNewCar({ title: '', route: '', capacity: 14, driver_id: '' });
      fetchData();
    } catch (error) {
      console.error('Error adding car:', error);
      toast({
        title: 'خطأ',
        description: 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCar = async (carId: string) => {
    try {
      const { error } = await supabase.from('cars').delete().eq('id', carId);
      if (error) throw error;

      toast({
        title: 'تم',
        description: 'تم حذف السيارة',
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting car:', error);
      toast({
        title: 'خطأ',
        description: 'لا يمكن حذف سيارة بها حجوزات',
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>إدارة السيارات</CardTitle>
            <CardDescription>أضف وأدِر السيارات</CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                إضافة سيارة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة سيارة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">اسم السيارة</Label>
                  <Input
                    id="title"
                    value={newCar.title}
                    onChange={(e) => setNewCar({ ...newCar, title: e.target.value })}
                    placeholder="مثال: Cairo-Airport-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="route">المسار</Label>
                  <Input
                    id="route"
                    value={newCar.route}
                    onChange={(e) => setNewCar({ ...newCar, route: e.target.value })}
                    placeholder="مثال: القاهرة - الإسكندرية"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">السعة</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={1}
                    max={14}
                    value={newCar.capacity}
                    onChange={(e) => setNewCar({ ...newCar, capacity: parseInt(e.target.value) || 14 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>السائق (اختياري)</Label>
                  <Select
                    value={newCar.driver_id}
                    onValueChange={(value) => setNewCar({ ...newCar, driver_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر سائق" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">بدون سائق</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.profiles?.name || 'غير معروف'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddCar} disabled={adding} className="w-full">
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'إضافة'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {cars.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>لا توجد سيارات</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cars.map((car) => (
              <div
                key={car.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <CarIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{car.title}</p>
                    <p className="text-sm text-muted-foreground">
                      السعة: {car.capacity} • المسار: {car.route || 'غير محدد'}
                    </p>
                  </div>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteCar(car.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

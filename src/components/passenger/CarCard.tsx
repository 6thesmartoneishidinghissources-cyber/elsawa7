import { Car } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Users, Car as CarIcon } from 'lucide-react';

interface CarCardProps {
  car: Car;
  onBook: () => void;
  disabled?: boolean;
}

export function CarCard({ car, onBook, disabled }: CarCardProps) {
  const availableSeats = car.available_seats ?? car.capacity;
  const isFull = availableSeats <= 0;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CarIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{car.title}</h3>
            {car.route && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{car.route}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className={`text-sm font-medium ${
              isFull ? 'text-destructive' : 'text-foreground'
            }`}>
              {availableSeats} / {car.capacity} متاح
            </span>
          </div>
          <div className={`rounded-full px-2 py-1 text-xs font-medium ${
            isFull 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            {isFull ? 'ممتلئة' : 'متاحة'}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="border-t bg-muted/20 px-6 py-4">
        <Button 
          className="w-full" 
          onClick={onBook}
          disabled={disabled || isFull}
        >
          {isFull ? 'ممتلئة' : 'احجز مقعد'}
        </Button>
      </CardFooter>
    </Card>
  );
}

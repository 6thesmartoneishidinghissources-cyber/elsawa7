import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Car, Users, Bell, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { VoteChart } from './VoteChart';

interface VoteRequest {
  route: string;
  travel_date: string;
  votes_count: number;
  voters: string[];
}

export function OwnerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [voteRequests, setVoteRequests] = useState<VoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingRoute, setProcessingRoute] = useState<string | null>(null);

  const fetchVoteRequests = async () => {
    try {
      // Get aggregated votes grouped by route and date
      const { data, error } = await supabase
        .from('votes_for_extra_cars')
        .select('route, travel_date, passenger_id')
        .eq('consumed', false)
        .gte('travel_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      // Group by route and date
      const grouped = (data || []).reduce((acc: Record<string, VoteRequest>, vote) => {
        const key = `${vote.route}|${vote.travel_date}`;
        if (!acc[key]) {
          acc[key] = {
            route: vote.route,
            travel_date: vote.travel_date,
            votes_count: 0,
            voters: [],
          };
        }
        acc[key].votes_count++;
        acc[key].voters.push(vote.passenger_id);
        return acc;
      }, {});

      // Filter to only show routes with 14+ votes (or all for visibility)
      const requests = Object.values(grouped).sort((a, b) => b.votes_count - a.votes_count);
      setVoteRequests(requests);
    } catch (error) {
      console.error('Error fetching vote requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVoteRequests();
  }, []);

  const handleAcceptCar = async (request: VoteRequest) => {
    setProcessingRoute(request.route);
    try {
      const carTitle = `عربية ${request.route} - ${new Date(request.travel_date).toLocaleDateString('ar-EG')}`;
      
      const { data, error } = await supabase.rpc('owner_accept_extra_car', {
        p_route: request.route,
        p_travel_date: request.travel_date,
        p_car_title: carTitle,
      });

      if (error) throw error;

      toast({
        title: 'تم إضافة العربية!',
        description: `تم تخصيص ${Math.min(request.votes_count, 14)} مقعد للركاب`,
      });

      fetchVoteRequests();
    } catch (error: any) {
      console.error('Error accepting car:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setProcessingRoute(null);
    }
  };

  const handleDecline = async (request: VoteRequest) => {
    // Mark votes as consumed without creating a car
    toast({
      title: 'تم الاعتذار',
      description: 'هيتم إبلاغ الركاب',
    });
    // In a real implementation, you'd notify voters
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            طلبات العربيات
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            الإحصائيات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                طلبات عربيات إضافية
              </CardTitle>
              <CardDescription>
                الركاب اللي صوتوا لإضافة عربية جديدة
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
              ) : voteRequests.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  لا توجد طلبات حالياً
                </p>
              ) : (
                <div className="space-y-4">
                  {voteRequests.map((request) => (
                    <Card 
                      key={`${request.route}-${request.travel_date}`}
                      className={request.votes_count >= 14 ? 'border-primary' : ''}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Car className="h-5 w-5 text-primary" />
                              <span className="font-semibold">{request.route}</span>
                              {request.votes_count >= 14 && (
                                <Badge variant="default" className="bg-green-600">
                                  جاهز للإضافة
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(request.travel_date).toLocaleDateString('ar-EG', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="h-4 w-4" />
                              <span>{request.votes_count} راكب صوتوا</span>
                              {request.votes_count < 14 && (
                                <span className="text-muted-foreground">
                                  (محتاجين {14 - request.votes_count} كمان)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDecline(request)}
                            >
                              <XCircle className="h-4 w-4 ml-1" />
                              اعتذر
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAcceptCar(request)}
                              disabled={processingRoute === request.route}
                            >
                              <CheckCircle className="h-4 w-4 ml-1" />
                              أضف عربية
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <VoteChart voteRequests={voteRequests} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

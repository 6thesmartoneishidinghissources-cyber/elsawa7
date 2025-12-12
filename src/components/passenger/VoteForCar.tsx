import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Car, ThumbsUp, Users } from 'lucide-react';

interface VoteForCarProps {
  route: string;
  travelDate: string; // YYYY-MM-DD format
  onVoteSuccess?: () => void;
}

interface VoteSummary {
  votes_count: number;
  remaining_to_trigger: number;
  total_needed: number;
}

export function VoteForCar({ route, travelDate, onVoteSuccess }: VoteForCarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [summary, setSummary] = useState<VoteSummary>({
    votes_count: 0,
    remaining_to_trigger: 14,
    total_needed: 14,
  });

  const fetchVoteSummary = async () => {
    try {
      const { data, error } = await supabase.rpc('get_vote_summary', {
        p_route: route,
        p_travel_date: travelDate,
      });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setSummary(data[0]);
      }
    } catch (error) {
      console.error('Error fetching vote summary:', error);
    }
  };

  const checkUserVote = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('votes_for_extra_cars')
        .select('id')
        .eq('passenger_id', user.id)
        .eq('route', route)
        .eq('travel_date', travelDate)
        .maybeSingle();

      if (error) throw error;
      setHasVoted(!!data);
    } catch (error) {
      console.error('Error checking user vote:', error);
    }
  };

  useEffect(() => {
    fetchVoteSummary();
    checkUserVote();
  }, [route, travelDate, user]);

  const handleVote = async () => {
    if (!user) {
      toast({
        title: 'تنبيه',
        description: 'لازم تسجل الدخول الأول',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('vote_for_extra_car', {
        p_route: route,
        p_travel_date: travelDate,
      });

      if (error) throw error;

      setHasVoted(true);
      
      if (data && data.length > 0) {
        setSummary({
          votes_count: Number(data[0].votes_count),
          remaining_to_trigger: Number(data[0].remaining_to_trigger),
          total_needed: 14,
        });
      }

      toast({
        title: 'تم التصويت!',
        description: 'صوتك اتسجل — هنخبرك لو العربية اتضافت',
      });

      onVoteSuccess?.();
      fetchVoteSummary();
    } catch (error: any) {
      console.error('Error voting:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حصل خطأ، حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = (summary.votes_count / summary.total_needed) * 100;
  const thresholdReached = summary.votes_count >= summary.total_needed;

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Car className="h-5 w-5 text-primary" />
          الحجوزات اكتملت لليوم
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          محتاجين عربية زيادة؟ صوت هنا لو محتاج عربية
        </p>

        {/* Progress visualization */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {summary.votes_count} راكب صوتوا
            </span>
            <span className="text-muted-foreground">
              {summary.remaining_to_trigger > 0 
                ? `محتاجين ${summary.remaining_to_trigger} كمان`
                : 'تم الوصول للعدد المطلوب!'}
            </span>
          </div>
          
          <Progress value={progressPercent} className="h-3" />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>{summary.total_needed} راكب</span>
          </div>
        </div>

        {thresholdReached ? (
          <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
            <p className="text-green-700 dark:text-green-300 font-medium">
              تم الوصول لعدد الركاب المطلوب — تم إرسال إشعار لمدير المؤسسة
            </p>
          </div>
        ) : (
          <Button 
            onClick={handleVote} 
            disabled={loading || hasVoted}
            className="w-full"
            variant={hasVoted ? 'secondary' : 'default'}
          >
            {hasVoted ? (
              <>
                <ThumbsUp className="h-4 w-4 ml-2" />
                صوتت بالفعل
              </>
            ) : loading ? (
              'جاري التصويت...'
            ) : (
              <>
                <ThumbsUp className="h-4 w-4 ml-2" />
                أنا محتاج عربية
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

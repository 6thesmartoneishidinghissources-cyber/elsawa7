import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';

interface VoteRequest {
  route: string;
  travel_date: string;
  votes_count: number;
}

interface VoteChartProps {
  voteRequests: VoteRequest[];
}

export function VoteChart({ voteRequests }: VoteChartProps) {
  // Prepare data for bar chart
  const barData = voteRequests.map(req => ({
    name: `${req.route} (${new Date(req.travel_date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })})`,
    votes: req.votes_count,
    needed: Math.max(0, 14 - req.votes_count),
  }));

  // Prepare data for pie chart - showing distribution of vote status
  const readyCount = voteRequests.filter(r => r.votes_count >= 14).length;
  const pendingCount = voteRequests.filter(r => r.votes_count < 14).length;
  
  const pieData = [
    { name: 'جاهز للإضافة', value: readyCount, color: '#22c55e' },
    { name: 'في الانتظار', value: pendingCount, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  // Summary stats
  const totalVotes = voteRequests.reduce((sum, r) => sum + r.votes_count, 0);
  const avgVotes = voteRequests.length > 0 ? Math.round(totalVotes / voteRequests.length) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{voteRequests.length}</div>
            <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{readyCount}</div>
            <p className="text-sm text-muted-foreground">جاهز للإضافة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{totalVotes}</div>
            <p className="text-sm text-muted-foreground">إجمالي الأصوات</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            توزيع الأصوات حسب المسار
          </CardTitle>
          <CardDescription>
            عدد الأصوات لكل مسار — الخط الأحمر = 14 راكب (سعة العربية)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" domain={[0, 'dataMax + 2']} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip 
                  formatter={(value: number) => [`${value} صوت`, 'عدد الأصوات']}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.votes >= 14 ? '#22c55e' : entry.votes >= 10 ? '#f59e0b' : '#3b82f6'}
                    />
                  ))}
                </Bar>
                {/* Reference line at 14 */}
                <XAxis 
                  type="number" 
                  orientation="top"
                  axisLine={false}
                  tickLine={false}
                  tick={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-muted-foreground">لا توجد بيانات</p>
          )}
        </CardContent>
      </Card>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              حالة الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

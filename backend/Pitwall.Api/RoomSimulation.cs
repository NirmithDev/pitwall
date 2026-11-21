// Authoritative counterpart of the local sandbox's geometry/pace model.
// Rooms accept definitions and decisions, never client positions or elapsed time.
public record CircuitSpec(int Version, string Id, string Name, double[][] Points, int[] SectorEnds, double CornerRadius);
public record RoomDriver(string Id, string Name, string Color, double PaceOffset, int PitLap, double ServiceSeconds);
public record RoomSetup(int Version, int RaceLaps, double BaseLapSeconds, double Entry, double Exit, double[][] PitControls, RoomDriver[] Drivers);
public record RoomDriverState {
    public required string Id { get; init; }
    public double RaceProgress { get; set; }
    public string Phase { get; set; } = "track";
    public double PitProgress { get; set; }
    public double StopRemaining { get; set; }
    public bool Serviced { get; set; }
    public bool Visited { get; set; }
    public int Stops { get; set; }
    public double? PitTarget { get; set; }
    public double? FinishTime { get; set; }
    public bool FinishedInPit { get; set; }
}
public sealed class RoomSimulation {
    public CircuitSpec Track { get; }
    public RoomSetup Setup { get; }
    public RoomDriverState[] States { get; private set; }
    public double Elapsed { get; private set; }
    public bool Complete => States.All(s => s.FinishTime.HasValue);
    readonly double mainLength, pitLength;
    public RoomSimulation(CircuitSpec track, RoomSetup setup) {
        Validate(track, setup);
        Track = track; Setup = setup;
        var main = Rounded(track.Points, track.CornerRadius, true);
        var closed = main.Append(main[0]).ToArray();
        var pit = Rounded(new[] {At(closed, setup.Entry)}.Concat(setup.PitControls).Append(At(closed, setup.Exit)).ToArray(), 24, false);
        mainLength = Length(closed); pitLength = Length(pit);
        if (pitLength < 20 || CrossesSelf(pit, false) || CrossesRoutes(pit, closed))
            throw new RoomError("The pit lane must be long enough and cannot cross itself or the circuit.");
        States = Initial();
    }
    RoomDriverState[] Initial() => Setup.Drivers.Select((d, i) => new RoomDriverState {
        Id = d.Id, RaceProgress = -i * .006,
        PitTarget = d.PitLap > 0 && d.PitLap - 1 + Setup.Entry < Setup.RaceLaps ? d.PitLap - 1 + Setup.Entry : null
    }).ToArray();
    public void Reset() { States = Initial(); Elapsed = 0; }
    public void Call(string driverId, bool box) {
        var s = States.Single(s => s.Id == driverId);
        if (s.Phase != "track") throw new RoomError("This driver has committed to the pit lane or finished.");
        if (!box) { s.PitTarget = null; return; }
        var target = Math.Floor(Math.Max(0, s.RaceProgress)) + Setup.Entry;
        if (target < s.RaceProgress - 1e-9) target++;
        if (target >= Setup.RaceLaps) throw new RoomError("No pit entry remains before the finish.");
        s.PitTarget = target;
    }
    public void Advance(double seconds) {
        if (!double.IsFinite(seconds) || seconds <= 0 || Complete) return;
        for (var i = 0; i < States.Length; i++) AdvanceDriver(States[i], Setup.Drivers[i], seconds);
        Elapsed = Complete ? States.Max(s => s.FinishTime!.Value) : Elapsed + seconds;
    }
    void AdvanceDriver(RoomDriverState s, RoomDriver d, double seconds) {
        if (s.Phase == "finished") return;
        var remaining = seconds;
        var lap = Setup.BaseLapSeconds + d.PaceOffset;
        var span = (Setup.Exit - Setup.Entry + 1) % 1;
        void Finish(bool pit) {
            s.FinishTime = Elapsed + seconds - remaining;
            s.FinishedInPit = pit; s.Phase = "finished";
            s.RaceProgress = Setup.RaceLaps; s.PitTarget = null; remaining = 0;
        }
        for (var guard = 0; remaining > 1e-9 && guard < 12; guard++) {
            if (s.Phase == "track") {
                var target = s.PitTarget ?? Setup.RaceLaps;
                var until = (target - s.RaceProgress) * lap;
                if (until >= -1e-8 && until <= remaining) {
                    s.RaceProgress = target; remaining -= Math.Max(0, until);
                    if (s.PitTarget is null) { Finish(false); break; }
                    s.Phase = "pit"; s.PitProgress = 0; s.Serviced = false; s.PitTarget = null;
                } else { s.RaceProgress += remaining / lap; remaining = 0; }
            } else if (s.Phase == "service") {
                var used = Math.Min(remaining, s.StopRemaining);
                remaining -= used; s.StopRemaining -= used;
                if (s.StopRemaining <= 1e-9) s.Phase = "pit";
            } else {
                var speed = mainLength / lap * .35 / Math.Max(1, pitLength);
                var stopTarget = s.Serviced ? 1 : .5;
                var fraction = (Setup.RaceLaps - s.RaceProgress) / span;
                var finish = fraction >= s.PitProgress - 1e-9 && fraction <= stopTarget + 1e-9;
                var target = finish ? Math.Min(stopTarget, Math.Max(s.PitProgress, fraction)) : stopTarget;
                var until = (target - s.PitProgress) / speed;
                if (until > remaining + 1e-8) { s.PitProgress += remaining * speed; remaining = 0; }
                else {
                    s.PitProgress = target; remaining = Math.Max(0, remaining - Math.Max(0, until));
                    if (finish) { Finish(true); break; }
                    if (!s.Serviced) { s.Serviced = true; s.Phase = "service"; s.StopRemaining = d.ServiceSeconds; }
                    else { s.Phase = "track"; s.Visited = true; s.Stops++; s.RaceProgress += span; }
                }
            }
        }
    }
    public string[] Order() => States.OrderBy(s => s.FinishTime.HasValue ? 0 : 1)
        .ThenBy(s => s.FinishTime ?? -(s.RaceProgress + (s.Phase is "pit" or "service" ? s.PitProgress * ((Setup.Exit - Setup.Entry + 1) % 1) : 0)))
        .Select(s => s.Id).ToArray();
    static bool Range(double n, double min, double max) => double.IsFinite(n) && n >= min && n <= max;
    static bool Points(double[][]? p, int min, int max) => p is not null && p.Length >= min && p.Length <= max &&
        p.All(v => v is {Length: 2} && Range(v[0], 20, 780) && Range(v[1], 20, 500));
    static void Validate(CircuitSpec t, RoomSetup s) {
        if (t is null || s is null || t.Version != 1 || s.Version != 1 || string.IsNullOrWhiteSpace(t.Name) || t.Name.Length > 48 ||
            string.IsNullOrWhiteSpace(t.Id) || t.Id.Length > 80 || !Points(t.Points, 6, 120) || !Range(t.CornerRadius, 0, 80) ||
            t.SectorEnds is not {Length: 2} || t.SectorEnds[0] <= 0 || t.SectorEnds[0] >= t.SectorEnds[1] || t.SectorEnds[1] >= t.Points.Length ||
            !Range(s.RaceLaps, 1, 50) || !Range(s.BaseLapSeconds, 30, 300) || !Range(s.Entry, 0, .99) || !Range(s.Exit, 0, .99) ||
            Math.Abs(s.Entry - s.Exit) < .01 || !Points(s.PitControls, 1, 12) || s.Drivers is null || s.Drivers.Length is < 1 or > 6)
            throw new RoomError("Provide a valid circuit, 1–50 laps, 1–6 drivers and bounded pit/pace settings.");
        if (CrossesSelf(t.Points.Append(t.Points[0]).ToArray(), true) ||
            t.Points.Where((p, i) => Distance(p, t.Points[(i + 1) % t.Points.Length]) < 8).Any() ||
            Math.Abs(t.Points.Select((p, i) => p[0] * t.Points[(i + 1) % t.Points.Length][1] - t.Points[(i + 1) % t.Points.Length][0] * p[1]).Sum()) < 1000)
            throw new RoomError("The circuit needs separated points, enough area and no crossing/touching edges.");
        var ids = new HashSet<string>();
        foreach (var d in s.Drivers) if (d is null || string.IsNullOrWhiteSpace(d.Id) || d.Id.Length > 80 || !ids.Add(d.Id) ||
            string.IsNullOrWhiteSpace(d.Name) || d.Name.Length > 24 || d.Color is null || !System.Text.RegularExpressions.Regex.IsMatch(d.Color, "^#[0-9a-fA-F]{6}$") ||
            !Range(d.PaceOffset, -10, 10) || d.PitLap is < 0 or > 10 || !Range(d.ServiceSeconds, 0, 15))
            throw new RoomError("Invalid driver settings or duplicate IDs.");
    }
    static double Distance(double[] a, double[] b) => Math.Sqrt(Math.Pow(a[0]-b[0], 2) + Math.Pow(a[1]-b[1], 2));
    static double[] Mix(double[] a, double[] b, double t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
    static double[] Curve(double[] a, double[] b, double[] c, double t) => Mix(Mix(a,b,t), Mix(b,c,t), t);
    static double SegmentDistance(double[] p, double[] a, double[] b) {
        var dx=b[0]-a[0]; var dy=b[1]-a[1]; var n=dx*dx+dy*dy;
        var t=n>0?Math.Clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n,0,1):0;
        return Distance(p,[a[0]+dx*t,a[1]+dy*t]);
    }
    static double Cross(double[] a,double[] b,double[] c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    static bool Touch(double[] a,double[] b,double[] p) => Math.Abs(Cross(a,b,p))<1e-7 && p[0]>=Math.Min(a[0],b[0])-1e-7 && p[0]<=Math.Max(a[0],b[0])+1e-7 && p[1]>=Math.Min(a[1],b[1])-1e-7 && p[1]<=Math.Max(a[1],b[1])+1e-7;
    static bool Intersects(double[] a,double[] b,double[] c,double[] d,bool touches) =>
        Cross(a,b,c)*Cross(a,b,d)<-1e-6 && Cross(c,d,a)*Cross(c,d,b)<-1e-6 || touches && (Touch(a,b,c)||Touch(a,b,d)||Touch(c,d,a)||Touch(c,d,b));
    static bool CrossesSelf(double[][] p,bool closed) {
        for(var i=1;i<p.Length;i++) for(var j=i+2;j<p.Length;j++) {
            if(closed && i==1 && j==p.Length-1)continue;
            if(Intersects(p[i-1],p[i],p[j-1],p[j],closed))return true;
        }
        return false;
    }
    static bool CrossesRoutes(double[][] a,double[][] b) {
        for(var i=1;i<a.Length;i++)for(var j=1;j<b.Length;j++)if(Intersects(a[i-1],a[i],b[j-1],b[j],false))return true;
        return false;
    }
    static double Length(double[][] p) => p.Skip(1).Select((v,i)=>Distance(p[i],v)).Sum();
    static double[] At(double[][] p,double fraction) {
        var target=Length(p)*fraction;
        for(var i=1;i<p.Length;i++){var span=Distance(p[i-1],p[i]);if(target<=span)return Mix(p[i-1],p[i],span>0?target/span:0);target-=span;}
        return p[^1];
    }
    static double[][] Rounded(double[][] p,double radius,bool closed) {
        if(!closed){
            var path=new List<double[]>{p[0]};
            for(var i=1;i<p.Length-1;i++){
                var trim=Math.Min(radius,Math.Min(Distance(p[i],p[i-1])*.4,Distance(p[i],p[i+1])*.4));
                var entry=Mix(p[i],p[i-1],trim/Math.Max(1e-12,Distance(p[i],p[i-1])));
                var exit=Mix(p[i],p[i+1],trim/Math.Max(1e-12,Distance(p[i],p[i+1])));
                path.Add(entry);for(var j=1;j<=12;j++)path.Add(Curve(entry,p[i],exit,j/12.0));
            }
            path.Add(p[^1]);return path.ToArray();
        }
        var corners=p.Select((v,i)=>{
            var previous=p[(i+p.Length-1)%p.Length];var next=p[(i+1)%p.Length];
            var clearance=Enumerable.Range(0,p.Length).Where(j=>j!=i&&(j+1)%p.Length!=i).Min(j=>SegmentDistance(v,p[j],p[(j+1)%p.Length]));
            var trim=Math.Min(radius,Math.Min(80,Math.Min(Distance(v,previous)*.45,Math.Min(Distance(v,next)*.45,clearance*.45))));
            return (v,entry:Mix(v,previous,trim/Distance(v,previous)),exit:Mix(v,next,trim/Distance(v,next)));
        }).ToArray();
        var result=new List<double[]>{Curve(corners[0].entry,corners[0].v,corners[0].exit,.5)};
        for(var j=9;j<=16;j++)result.Add(Curve(corners[0].entry,corners[0].v,corners[0].exit,j/16.0));
        foreach(var c in corners.Skip(1)){result.Add(c.entry);for(var j=1;j<=16;j++)result.Add(Curve(c.entry,c.v,c.exit,j/16.0));}
        result.Add(corners[0].entry);for(var j=1;j<8;j++)result.Add(Curve(corners[0].entry,corners[0].v,corners[0].exit,j/16.0));
        var clean=result.Where((v,i)=>i==0||Distance(v,result[i-1])>.0001).ToList();
        if(clean.Count>1&&Distance(clean[^1],clean[0])<.0001)clean.RemoveAt(clean.Count-1);
        return clean.ToArray();
    }
}
public sealed class RoomError(string message) : Exception(message);

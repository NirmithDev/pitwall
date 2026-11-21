using System.Text.Json;
static void Check(bool value,string message){if(!value)throw new Exception(message);}
static void Reject(Action action,string text){try{action();throw new Exception("Expected rejection: "+text);}catch(RoomError e){Check(e.Message.Contains(text,StringComparison.OrdinalIgnoreCase),e.Message);}}
static void Near(double a,double b)=>Check(Math.Abs(a-b)<1e-7,$"Expected {a} ≈ {b}");
var track=new CircuitSpec(1,"room-check","Shared test circuit",[[150,150],[400,150],[650,150],[650,370],[400,370],[150,370]],[2,4],0);
var setup=new RoomSetup(1,3,30,.92,.08,[[80,265],[80,80],[265,80]],[new("one","One","#ff665d",0,1,2.5),new("two","Two","#6d9fff",2,0,2.5)]);
var a=new RoomSimulation(track,setup);var b=new RoomSimulation(track,setup);
a.Advance(180);for(var i=0;i<1800;i++)b.Advance(.1);
foreach(var s in a.States){var other=b.States.Single(v=>v.Id==s.Id);Near(s.FinishTime!.Value,other.FinishTime!.Value);Check(s.Phase=="finished","Race did not finish");}
Near(a.States[1].FinishTime!.Value,3.006*32);
var frozen=a.Elapsed;a.Advance(100);Near(a.Elapsed,frozen);
var pit=new RoomSimulation(track,setup);pit.Call("one",false);pit.Advance(30);Near(pit.States[0].RaceProgress,1);
pit.Call("one",true);Near(pit.States[0].PitTarget!.Value,1.92);
pit.Advance(30);Check(pit.States[0].Phase is "pit" or "service","Live stop did not enter lane");Reject(()=>pit.Call("one",false),"committed");
Reject(()=>new RoomSimulation(track,setup with{RaceLaps=0}),"valid");
Reject(()=>new RoomSimulation(track,setup with{Drivers=[setup.Drivers[0],setup.Drivers[0]]}),"duplicate");
var rooms=new RaceRooms();var host=rooms.Create(new("Host",track,setup));var guest=rooms.Join(host.Code,"Guest");
var h=rooms.Attach("h",host.Code,host.Token);rooms.Attach("g",host.Code,guest.Token);
Reject(()=>rooms.Attach("bad",host.Code,"wrong"),"session");
Reject(()=>rooms.Execute("g",new("start")),"host");
Reject(()=>rooms.Execute("h",new("start")),"ready");
var claims=0;Parallel.Invoke(
    ()=>{try{rooms.Execute("h",new("claim","one"));Interlocked.Increment(ref claims);}catch(RoomError){}},
    ()=>{try{rooms.Execute("g",new("claim","one"));Interlocked.Increment(ref claims);}catch(RoomError){}});
Check(claims==1,"Concurrent clients both claimed one driver");
// Normalize ownership for permission, handover and reconnect checks.
rooms.Execute("h",new("release","one"));rooms.Execute("h",new("claim","one"));rooms.Execute("g",new("claim","two"));
Reject(()=>rooms.Execute("g",new("box","one")),"claimed driver");
rooms.Execute("h",new("ready"));rooms.Execute("g",new("ready"));rooms.Execute("h",new("start"));
var updates=rooms.Advance(.5);Check(updates.Single().Elapsed>0,"Server clock did not advance");
rooms.Execute("h",new("pause"));var paused=rooms.Advance(.5);Check(paused.Length==0,"Paused room advanced");
rooms.Detach("g");var reconnect=rooms.Attach("g2",host.Code,guest.Token);Check(reconnect.Seats.Single(s=>s.DriverId=="two").PlayerId==guest.PlayerId,"Reconnect lost seat");
rooms.Execute("g2",new("release","two"));rooms.Execute("h",new("handover","one",guest.PlayerId));
Reject(()=>rooms.Execute("h",new("box","one")),"claimed driver");rooms.Execute("g2",new("box","one"));
var transferred=rooms.Execute("h",new("host",PlayerId:guest.PlayerId));Check(transferred.HostId==guest.PlayerId,"Host transfer failed");
Reject(()=>rooms.Execute("h",new("reset")),"host");rooms.Execute("g2",new("reset"));
rooms.Execute("g2",new("leave"));Reject(()=>rooms.Attach("again",host.Code,guest.Token),"session");
var extra=rooms.Join(host.Code,"Removable");rooms.Attach("extra",host.Code,extra.Token);
rooms.Execute("h",new("remove",PlayerId:extra.PlayerId));
Reject(()=>rooms.Attach("extra-again",host.Code,extra.Token),"session");
Reject(()=>rooms.Execute("extra",new("claim","two")),"Reconnect");
Console.WriteLine("PASS: authoritative physics, frame invariance, finite results, live calls, validation, concurrent seat claims, host/driver permissions, reconnect, handover and leave.");
var jsonOptions=new JsonSerializerOptions{PropertyNamingPolicy=JsonNamingPolicy.CamelCase,WriteIndented=true};
if(args.Length==2&&args[0]=="--write-fixture"){
    var fixtureTrack=track with{CornerRadius=28};
    var sim=new RoomSimulation(fixtureTrack,setup);var samples=new List<object>();
    foreach(var seconds in new[]{28.0,4,4,4,5,35,100}){
        sim.Advance(seconds);
        samples.Add(new{seconds,elapsed=sim.Elapsed,states=sim.States.Select(s=>s with{}).ToArray(),order=sim.Order()});
    }
    Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(args[1]))!);
    File.WriteAllText(args[1],JsonSerializer.Serialize(new{track=fixtureTrack,setup,samples},jsonOptions));
}
var fixturePath=Path.Combine(AppContext.BaseDirectory,"room-model.json");
if(File.Exists(fixturePath)){
    using var fixture=JsonDocument.Parse(File.ReadAllText(fixturePath));var root=fixture.RootElement;
    var sim=new RoomSimulation(root.GetProperty("track").Deserialize<CircuitSpec>(jsonOptions)!,root.GetProperty("setup").Deserialize<RoomSetup>(jsonOptions)!);
    foreach(var sample in root.GetProperty("samples").EnumerateArray()){
        sim.Advance(sample.GetProperty("seconds").GetDouble());Near(sim.Elapsed,sample.GetProperty("elapsed").GetDouble());
        foreach(var expected in sample.GetProperty("states").EnumerateArray()){
            var actual=sim.States.Single(s=>s.Id==expected.GetProperty("id").GetString());
            Near(actual.RaceProgress,expected.GetProperty("raceProgress").GetDouble());
            Near(actual.PitProgress,expected.GetProperty("pitProgress").GetDouble());
            Near(actual.StopRemaining,expected.GetProperty("stopRemaining").GetDouble());
            Check(actual.Phase==expected.GetProperty("phase").GetString(),"Shared model phase drift");
            Check(actual.Stops==expected.GetProperty("stops").GetInt32(),"Shared model stop count drift");
            if(actual.FinishTime.HasValue)Near(actual.FinishTime.Value,expected.GetProperty("finishTime").GetDouble());
        }
    }
    Console.WriteLine("PASS: shared browser/server model contract fixture.");
}

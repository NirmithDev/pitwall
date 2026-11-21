using System.Diagnostics;
using System.Security.Cryptography;
using Microsoft.AspNetCore.SignalR;

public record RoomCreateInput(string Name, CircuitSpec Track, RoomSetup Setup);
public record RoomJoinInput(string Name);
public record RoomTicket(string Code, string PlayerId, string Token);
public record RoomCommand(string Action, string? DriverId = null, string? PlayerId = null, double? Speed = null);
public record RoomPlayerView(string Id, string Name, bool Connected, bool Ready);
public record RoomSeatView(string DriverId, string? PlayerId);
public record RoomView(string Code, long Revision, string HostId, CircuitSpec Track, RoomSetup Setup,
    RoomPlayerView[] Players, RoomSeatView[] Seats, RoomDriverState[] States, string[] Order,
    double Elapsed, bool Running, double Speed, bool Complete);

// All room mutations and snapshots share one lock. A single process owns each race.
public sealed class RaceRooms {
    sealed class Player(string name) {
        public string Id { get; } = Guid.NewGuid().ToString("N");
        public string Token { get; } = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        public string Name { get; } = name;
        public bool Ready { get; set; }
        public HashSet<string> Connections { get; } = [];
        public long LastCommand { get; set; }
        public int CommandCount { get; set; }
    }
    sealed class Room(string code, RoomSimulation simulation, Player host) {
        public string Code { get; } = code;
        public RoomSimulation Sim { get; } = simulation;
        public string HostId { get; set; } = host.Id;
        public List<Player> Players { get; } = [host];
        public Dictionary<string, string?> Seats { get; } = simulation.Setup.Drivers.ToDictionary(d=>d.Id,_=>(string?)null);
        public bool Running { get; set; }
        public double Speed { get; set; } = 10;
        public long Revision { get; set; }
        public DateTimeOffset LastActive { get; set; } = DateTimeOffset.UtcNow;
    }
    readonly object gate = new();
    readonly Dictionary<string,Room> rooms = [];
    readonly Dictionary<string,(Room room,Player player)> connections = [];
    readonly List<(string Connection,string Code)> revoked = [];
    static string Name(string? name) => !string.IsNullOrWhiteSpace(name) && name.Trim().Length<=24 && !name.Any(char.IsControl)
        ? name.Trim() : throw new RoomError("Use a guest name of 1–24 characters.");
    Room Find(string code) => code is {Length:12} && rooms.TryGetValue(code.ToUpperInvariant(),out var room) ? room : throw new RoomError("Room unavailable or expired. Ask the host for a fresh invitation.");
    public RoomTicket Create(RoomCreateInput input) {
        var name=Name(input.Name);
        var sim=new RoomSimulation(input.Track,input.Setup);
        lock(gate) {
            Expire();
            if(rooms.Count>=32)throw new RoomError("The server has 32 rooms already. Try again later.");
            string code;do{code=Convert.ToHexString(RandomNumberGenerator.GetBytes(6));}while(rooms.ContainsKey(code));
            var host=new Player(name);var room=new Room(code,sim,host);rooms.Add(code,room);
            return new(code,host.Id,host.Token);
        }
    }
    public RoomTicket Join(string code,string name) {
        name=Name(name);
        lock(gate){
            Expire();var room=Find(code);
            if(room.Players.Count>=12)throw new RoomError("This room already has twelve guests, including spectators.");
            var player=new Player(name);room.Players.Add(player);room.LastActive=DateTimeOffset.UtcNow;room.Revision++;
            return new(room.Code,player.Id,player.Token);
        }
    }
    public RoomView Attach(string connection,string code,string token) {
        lock(gate){
            var room=Find(code);
            var player=room.Players.FirstOrDefault(p=>p.Token==token)??throw new RoomError("Guest session unavailable. Join again with the invitation.");
            if(connections.ContainsKey(connection))throw new RoomError("This connection is already in a room.");
            connections[connection]=(room,player);player.Connections.Add(connection);
            room.LastActive=DateTimeOffset.UtcNow;room.Revision++;
            return View(room);
        }
    }
    public RoomView? Detach(string connection) {
        lock(gate){
            if(!connections.Remove(connection,out var member))return null;
            member.player.Connections.Remove(connection);member.room.Revision++;
            member.room.LastActive=DateTimeOffset.UtcNow;
            return rooms.ContainsKey(member.room.Code)?View(member.room):null;
        }
    }
    public RoomView Execute(string connection,RoomCommand command) {
        lock(gate){
            if(!connections.TryGetValue(connection,out var member))throw new RoomError("Reconnect to the room first.");
            var (room,player)=member;
            if(!room.Players.Contains(player))throw new RoomError("You left this room. Join again.");
            var now=Stopwatch.GetTimestamp();
            if(player.LastCommand==0 || Stopwatch.GetElapsedTime(player.LastCommand,now).TotalSeconds>=1){player.LastCommand=now;player.CommandCount=0;}
            if(++player.CommandCount>20)
                throw new RoomError("Please wait a moment before the next decision.");
            var host=room.HostId==player.Id;
            string Driver() => command.DriverId is not null&&room.Seats.ContainsKey(command.DriverId)?command.DriverId:throw new RoomError("Choose a driver.");
            void Host(){if(!host)throw new RoomError("Only the host can change race controls.");}
            switch(command.Action){
                case "claim": {
                    var driver=Driver();
                    if(room.Seats[driver] is not null && room.Seats[driver]!=player.Id)throw new RoomError("That driver is already claimed.");
                    foreach(var key in room.Seats.Where(kv=>kv.Value==player.Id).Select(kv=>kv.Key).ToArray())room.Seats[key]=null;
                    room.Seats[driver]=player.Id;player.Ready=false;break;
                }
                case "release": case "handover": {
                    var driver=Driver();
                    if(room.Seats[driver]!=player.Id&&!host)throw new RoomError("Only the owner or host can hand over a driver.");
                    Player? target=null;
                    if(command.Action=="handover"){
                        target=room.Players.FirstOrDefault(p=>p.Id==command.PlayerId&&p.Connections.Count>0)??throw new RoomError("Choose a connected guest.");
                        if(room.Seats.Values.Contains(target.Id))throw new RoomError("That guest already controls a driver. Release it first.");
                    }
                    room.Seats[driver]=target?.Id;if(target is not null)target.Ready=false;break;
                }
                case "ready":
                    if(!room.Seats.Values.Contains(player.Id))throw new RoomError("Claim a driver before getting ready.");
                    player.Ready=!player.Ready;break;
                case "start":
                    Host();
                    if(room.Sim.Complete)throw new RoomError("Reset the finished race first.");
                    if(room.Sim.Elapsed==0 && (!room.Seats.Values.Any(v=>v is not null)||room.Players.Any(p=>room.Seats.Values.Contains(p.Id)&&(!p.Ready||p.Connections.Count==0))))
                        throw new RoomError("At least one driver must be claimed. All claimed drivers must be connected and ready.");
                    room.Running=true;break;
                case "pause": Host();room.Running=false;break;
                case "reset": Host();room.Running=false;room.Sim.Reset();foreach(var p in room.Players)p.Ready=false;break;
                case "speed": Host();if(command.Speed is not (1 or 5 or 10 or 25))throw new RoomError("Choose 1×, 5×, 10× or 25×.");room.Speed=command.Speed.Value;break;
                case "box": case "cancel": {
                    var driver=Driver();
                    if(room.Seats[driver]!=player.Id)throw new RoomError("You can make pit calls only for your claimed driver.");
                    room.Sim.Call(driver,command.Action=="box");break;
                }
                case "host":
                    Host();var next=room.Players.FirstOrDefault(p=>p.Id==command.PlayerId&&p.Connections.Count>0)??throw new RoomError("Choose a connected guest.");
                    room.HostId=next.Id;break;
                case "remove": {
                    Host();var removed=room.Players.FirstOrDefault(p=>p.Id==command.PlayerId&&p.Id!=player.Id)??throw new RoomError("Choose another guest to remove.");
                    foreach(var key in room.Seats.Where(kv=>kv.Value==removed.Id).Select(kv=>kv.Key).ToArray())room.Seats[key]=null;
                    room.Players.Remove(removed);
                    foreach(var id in removed.Connections){connections.Remove(id);revoked.Add((id,room.Code));}
                    removed.Connections.Clear();break;
                }
                case "leave":
                    foreach(var key in room.Seats.Where(kv=>kv.Value==player.Id).Select(kv=>kv.Key).ToArray())room.Seats[key]=null;
                    room.Players.Remove(player);
                    foreach(var id in player.Connections){connections.Remove(id);revoked.Add((id,room.Code));}
                    player.Connections.Clear();
                    if(host && room.Players.Count>0)room.HostId=room.Players.OrderByDescending(p=>p.Connections.Count>0).First().Id;
                    if(room.Players.Count==0)rooms.Remove(room.Code);
                    break;
                default: throw new RoomError("Unknown room decision.");
            }
            room.LastActive=DateTimeOffset.UtcNow;room.Revision++;
            return View(room);
        }
    }
    public RoomView[] Advance(double seconds) {
        lock(gate){
            Expire();var updates=new List<RoomView>();
            foreach(var room in rooms.Values){
                if(room.Players.Any(p=>p.Connections.Count>0))room.LastActive=DateTimeOffset.UtcNow;
                if(!room.Running)continue;
                room.Sim.Advance(Math.Clamp(seconds,0,1)*room.Speed);
                if(room.Sim.Complete)room.Running=false;
                room.Revision++;updates.Add(View(room));
            }
            return updates.ToArray();
        }
    }
    public (string Connection,string Code)[] DrainRevoked() {
        lock(gate){var result=revoked.ToArray();revoked.Clear();return result;}
    }
    void Expire(){
        foreach(var room in rooms.Values.Where(r=>DateTimeOffset.UtcNow-r.LastActive>TimeSpan.FromHours(2)).ToArray())rooms.Remove(room.Code);
    }
    static RoomView View(Room r)=>new(r.Code,r.Revision,r.HostId,r.Sim.Track,r.Sim.Setup,
        r.Players.Select(p=>new RoomPlayerView(p.Id,p.Name,p.Connections.Count>0,p.Ready)).ToArray(),
        r.Seats.Select(k=>new RoomSeatView(k.Key,k.Value)).ToArray(),r.Sim.States.Select(s=>s with{}).ToArray(),r.Sim.Order(),r.Sim.Elapsed,r.Running,r.Speed,r.Sim.Complete);
}
public sealed class RaceRoomHub(RaceRooms rooms):Hub {
    public async Task<RoomView> Enter(string code,string token){
        try {
            var room=rooms.Attach(Context.ConnectionId,code,token);
            await Groups.AddToGroupAsync(Context.ConnectionId,room.Code);
            await Clients.Group(room.Code).SendAsync("Room",room);
            return room;
        }catch(RoomError e){throw new HubException(e.Message);}
    }
    public async Task<RoomView> Decide(RoomCommand command){
        try {
            var room=rooms.Execute(Context.ConnectionId,command);
            foreach(var removed in rooms.DrainRevoked()){
                await Groups.RemoveFromGroupAsync(removed.Connection,removed.Code);
                if(removed.Connection!=Context.ConnectionId)await Clients.Client(removed.Connection).SendAsync("MembershipEnded");
            }
            if(command.Action=="leave")await Groups.RemoveFromGroupAsync(Context.ConnectionId,room.Code);
            await Clients.Group(room.Code).SendAsync("Room",room);
            return room;
        }catch(RoomError e){throw new HubException(e.Message);}
    }
    public override async Task OnDisconnectedAsync(Exception? exception){
        var room=rooms.Detach(Context.ConnectionId);
        if(room is not null)await Clients.Group(room.Code).SendAsync("Room",room);
        await base.OnDisconnectedAsync(exception);
    }
}
public sealed class RaceRoomClock(RaceRooms rooms,IHubContext<RaceRoomHub> hub):BackgroundService {
    protected override async Task ExecuteAsync(CancellationToken stoppingToken){
        using var timer=new PeriodicTimer(TimeSpan.FromMilliseconds(100));
        var previous=Stopwatch.GetTimestamp();
        while(await timer.WaitForNextTickAsync(stoppingToken)){
            var now=Stopwatch.GetTimestamp();var seconds=Stopwatch.GetElapsedTime(previous,now).TotalSeconds;previous=now;
            foreach(var room in rooms.Advance(seconds))await hub.Clients.Group(room.Code).SendAsync("Room",room,stoppingToken);
        }
    }
}

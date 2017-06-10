import {Operation} from "./ai/operations/Operation";
import {Mission} from "./ai/missions/Mission";
import {Agent} from "./ai/agents/Agent";
import {RoomHelper} from "./ai/RoomHelper";
import {Notifier} from "./notifier";
import {empire} from "./ai/Empire";
import {helper} from "./helpers/helper";
import {Traveler, TravelToReturnData} from "./ai/Traveler";
import {Profiler} from "./Profiler";
import {Viz} from "./helpers/Viz";

export var sandBox = {
    run: function() {

        let pos = Game.spawns["Spawn1"].pos;
        Viz.animatedPos(pos, "aqua", .5, 1, 10);

        let travFlag = Game.flags["travFlag"];
        if (travFlag) {


            let newTravelerCreep = Game.creeps["newTraveler"];
            if (!newTravelerCreep) {
                empire.spawnFromClosest(travFlag.pos, [MOVE], "newTraveler");
            }
            let oldTravelerCreep = Game.creeps["oldTraveler"];
            if (!oldTravelerCreep) {
                empire.spawnFromClosest(travFlag.pos, [MOVE], "oldTraveler");
            }

            let newTravelerTest = () => {
                Profiler.start("test.newTrav", true);
                newTravelerCreep.travelTo(travFlag, {range: 1, preferHighway: true});
                Profiler.end("test.newTrav");
            };

            let oldTravelerTest = () => {
                Profiler.start("test.oldTrav", true);
                // oldTraveler.travelTo(oldTravelerCreep, travFlag, {range: 1, preferHighway: true});
                Profiler.end("test.oldTrav");
            };

            let tests = [newTravelerTest, oldTravelerTest];
            if (Math.random() > .5) {
                // eliminate order effects
                tests = [oldTravelerTest, newTravelerTest];
            }

            if (newTravelerCreep && oldTravelerCreep) {
                for (let test of tests) {
                    test();
                }
            }
        }

        let destination = Game.flags["obstacleFlag"];
        if (destination) {
            let creep = Game.creeps["obstacle"];
            if (creep) {
                let data = {} as TravelToReturnData;
                creep.travelTo(destination, {returnData: data});
                if (data.path) { creep.say(`${data.path.length} more!`); }
            } else {
                empire.spawnFromClosest(destination.pos, [MOVE], "obstacle");
            }

            let destFlag = Game.flags["destFlag"];
            if (destFlag && Game.time % 5 === 0) {
                let cpu = Game.cpu.getUsed();
                let route = Traveler.findRoute(destination.pos.roomName, destFlag.pos.roomName, {highwayBias: 2.5});
                console.log(JSON.stringify(route));
                console.log(Game.cpu.getUsed() - cpu);
            }
        }

        let sandboxFlag = Game.flags["sandbox"];
        if (sandboxFlag) {
            let sandboxOp = new SandboxOperation(sandboxFlag, "sand0", "sandbox");
            global.sand0 = sandboxOp;
            // sandboxOp.init();
            // sandboxOp.roleCall();
            // sandboxOp.actions();
            // sandboxOp.finalize();
        }

        if (!Memory.temp.ranTest) {
            Memory.temp.ranTest = true;
            let place1 = Game.flags["keeper_lima6"];
            let destinations = _.toArray(empire.spawnGroups);
            let selected = RoomHelper.findClosest(place1, destinations, {margin: 50});
            console.log(`selected the following: `);
            for (let value of selected) { console.log(value.destination.pos); }
        }

        if (Game.time % 10 === 0) {
            console.log("cpu: " + _.round(Memory.cpu.average, 2), "perCreep: " +
                _.round(Memory.cpu.average / Object.keys(Game.creeps).length, 2));
        }

        if (Memory.temp.test) {
            // testSerialPos();
            testFunction();
            Memory.temp.test = undefined;
        }

        nukePos();
    },
};

function nukePos() {
    if (!Memory.temp.nukePos) { return; }
    if (Game.time < Memory.temp.nextNuke) { return; }
    let position = helper.deserializeRoomPosition(Memory.temp.nukePos);
    for (let roomName in empire.spawnGroups) {
        if (Game.map.getRoomLinearDistance(position.roomName, roomName) > 10) { continue; }
        let room = Game.rooms[roomName];
        let nuker = room.findStructures<StructureNuker>(STRUCTURE_NUKER)[0];
        if (!nuker) { continue; }
        let outcome = nuker.launchNuke(position);
        console.log(`${roomName} is nuking ${position}, outcome: ${outcome}`);
        if (outcome === OK) {
            Memory.temp.nextNuke = Game.time + 300;
            return;
        }
    }

    console.log("all nukes in range have been launched");
    Memory.temp.nukePos =  undefined;
}

function testFunction() {
    let cpu = Game.cpu.getUsed();

    console.log(`operator: ${Game.cpu.getUsed() - cpu}`);

    cpu = Game.cpu.getUsed();

    console.log(`function: ${Game.cpu.getUsed() - cpu}`);
}

function testSerialPos() {
    let room = Game.spawns["Spawn1"].room;
    let positions = room.find<Structure>(FIND_STRUCTURES).map(s => s.pos);
    let jsons = positions.map(p => { return {x: p.x, y: p.y, roomName: p.roomName}; });
    let integers = positions.map(p => room.serializePosition(p));
    let unicodes = positions.map(p => room.serializePositionTest(p));

    console.log("\nthese compare what the overhead per tick would be for just storage");
    let cpu = Game.cpu.getUsed();
    for (let i = 0; i < 100; i++) {
        let str = JSON.stringify(jsons);
        JSON.parse(str);
    }
    console.log(`nonserialized: ${Game.cpu.getUsed() - cpu}`);
    cpu = Game.cpu.getUsed();
    for (let i = 0; i < 100; i++) {
        let str = JSON.stringify(integers);
        JSON.parse(str);
    }
    console.log(`type 1: ${Game.cpu.getUsed() - cpu}`);
    cpu = Game.cpu.getUsed();
    for (let i = 0; i < 100; i++) {
        let str = JSON.stringify(unicodes);
        JSON.parse(str);
    }
    console.log(`type 2: ${Game.cpu.getUsed() - cpu}`);

    console.log("\nthese compare the cost for deserialization");
    cpu = Game.cpu.getUsed();
    for (let json of jsons) {
        let position = new RoomPosition(json.x, json.y, json.roomName);
    }
    console.log(`json: ${Game.cpu.getUsed() - cpu}`);
    cpu = Game.cpu.getUsed();
    for (let json of jsons) {
        let position = _.create(json);
    }
    console.log(`json (lodash): ${Game.cpu.getUsed() - cpu}`);
    cpu = Game.cpu.getUsed();
    for (let integer of integers) {
        let position = room.deserializePosition(integer);
    }
    console.log(`integer: ${Game.cpu.getUsed() - cpu}`);
    cpu = Game.cpu.getUsed();
    for (let unicode of unicodes) {
        let position = room.deserializePositionTest(unicode);
    }
    console.log(`unicode: ${Game.cpu.getUsed() - cpu}`);
}

class SandboxOperation extends Operation {
    protected update() {
    }
    public init() {
        this.addMission(new SandboxMission(this, "sandbox"));
    }

    public finalize() {
    }

    public invalidateCache() {
    }

}

class SandboxMission extends Mission {
    protected init() {
    }
    public update() {
    }

    public roleCall() {
    }

    public actions() {
        // this.squadTravelTest();
        // this.fleeByPathTest();
        this.fatigueTest();
    }

    public finalize() {
    }

    public invalidateCache() {
    }

    public squadTravelTest() {
        let leaderCreep = Game.creeps["leader"];
        let leader;
        if (leaderCreep) {
            leader = new Agent(leaderCreep, this);
        } else {
            empire.spawnFromClosest(this.flag.pos, [MOVE], "leader");
        }

        let followerCreep = Game.creeps["follower"];
        let follower;
        if (followerCreep) {
            follower = new Agent(followerCreep, this);
        } else {
            empire.spawnFromClosest(this.flag.pos, [MOVE], "follower");
        }

        if (!leader || !follower) { return; }

        Agent.squadTravel(leader, follower, this.flag);
    }

    private fleeByPathTest() {
        let fleeFlag = Game.flags["fleeFlag"];
        if (!fleeFlag) { return; }

        let fleeCreep = Game.creeps["fleeCreep"];
        if (!fleeCreep) {
            empire.spawnFromClosest(fleeFlag.pos, [MOVE], "fleeCreep");
            return;
        }

        let agent = new Agent(fleeCreep, this);
        fleeFlag["id"] = "scaryGuy";
        let fleeing = agent.fleeByPath([fleeFlag as any], 6, 3);
        if (!fleeing) {
            agent.travelTo(fleeFlag);
        }
    }

    private fatigueTest() {
        let fattyCreep = Game.creeps["fatty"];
        if (!fattyCreep) {
            empire.spawnFromClosest(this.flag.pos, [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE],
                "fatty");
            return;
        }
        let fatty = new Agent(fattyCreep, this);
        fatty.travelTo(this.flag);
    }
}

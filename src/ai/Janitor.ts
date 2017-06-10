import {Scheduler} from "../Scheduler";
import {Notifier} from "../notifier";
import {helper} from "../helpers/helper";
import {Viz} from "../helpers/Viz";
export class Janitor {

    private memory: {
        errantConstructionRooms: {[roomName: string]: boolean}
        checkStraySites: number,
    };

    public init() {
        if (!Memory.empire.janitor) { Memory.empire.janitor = {}; }
        this.memory = Memory.empire.janitor;
        if (!this.memory.errantConstructionRooms) { this.memory.errantConstructionRooms = {}; }
    }

    public update() {
        this.memory = Memory.empire.janitor;
    }

    public actions() {
        this.clearErrantConstruction();
        this.scavengeResources();
        this.garbageCollection();
    }

    private clearErrantConstruction() {
        if (Scheduler.delay(this.memory, "checkStraySites", 100)) { return; }

        let removeErrantStatus = {};
        let addErrantStatus = {};
        for (let siteName in Game.constructionSites) {
            let site = Game.constructionSites[siteName];
            if (site.room) {
                delete this.memory.errantConstructionRooms[site.pos.roomName];
            } else {
                if (this.memory.errantConstructionRooms[site.pos.roomName]) {
                    site.remove();
                    removeErrantStatus[site.pos.roomName] = true;
                } else {
                    addErrantStatus[site.pos.roomName] = true;
                }
            }
        }

        for (let roomName in addErrantStatus) {
            this.memory.errantConstructionRooms[roomName] = true;
        }

        for (let roomName in removeErrantStatus) {
            Notifier.log(`EMPIRE: removed construction sites in ${roomName}`);
            delete this.memory.errantConstructionRooms[roomName];
        }
    }

    private scavengeResources() {
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            let resources = room.find(FIND_DROPPED_RESOURCES) as Resource[];
            for (let resource of resources) {
                if (resource.amount < 50) { continue; }
                let creep = resource.pos.lookFor(LOOK_CREEPS)[0] as Creep;
                if (creep && creep.my && creep.memory.scavenger === resource.resourceType
                    && (!creep.carry[resource.resourceType] ||
                    creep.carry[resource.resourceType] < creep.carryCapacity)) {
                    let outcome = creep.pickup(resource);
                }
            }
        }
    }

    private garbageCollection() {

        if (Game.time < Memory.nextGC) { return; }

        for (let id in Memory.hostileMemory) {
            let creep = Game.getObjectById<Creep>(id);
            if (!creep) { delete Memory.hostileMemory[id]; }
        }

        Memory.nextGC = Game.time + helper.randomInterval(100);
    }
}

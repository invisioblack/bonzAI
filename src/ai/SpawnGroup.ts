import {SpawnReservation} from "../interfaces";
import {helper} from "../helpers/helper";
import {Scheduler} from "../Scheduler";
export class SpawnGroup {

    private roomName: string;
    private spawnIds: string[];

    public spawns: Spawn[];
    public room: Room;
    public pos: RoomPosition;
    public idleSpawnCount: number;
    public isAvailable: boolean;
    public currentSpawnEnergy: number;
    public maxSpawnEnergy: number;
    public refillEfficiency: number; // 0 = no refilling activity, 1 = maximum

    public memory: {
        efficiency: number;
        nextCheck: number;
        log: {
            availability: number
            history: number[]
            longHistory: number[]
        },
    };

    constructor(roomName: string) {
        this.roomName = roomName;
    }

    public static init(spawnGroups: {[roomName: string]: SpawnGroup}) {
        for (let roomName in spawnGroups) {
            let spawnGroup = spawnGroups[roomName];
            spawnGroup.init();
        }
    }

    public init() {
        this.room = Game.rooms[this.roomName];
        this.initMemory();
        let spawns = _(this.room.find<StructureSpawn>(FIND_MY_SPAWNS))
            .filter(s => s.canCreateCreep([MOVE]) !== ERR_RCL_NOT_ENOUGH)
            .value();
        this.spawnIds = _.map(spawns, x => x.id);
        this.pos = _.head(spawns).pos;
    }

    public static update(spawnGroups: {[roomName: string]: SpawnGroup}) {
        for (let roomName in spawnGroups) {
            let spawnGroup = spawnGroups[roomName];
            let invalid = spawnGroup.update();
            if (invalid) {
                delete spawnGroups[roomName];
            }
        }
    }

    /**
     * @returns invalid {boolean}
     */

    public update(): boolean {
        this.room = Game.rooms[this.roomName];
        if (!this.room) { return true; } // lost vision since it was instantiated
        this.initMemory();
        this.currentSpawnEnergy = this.room.energyAvailable;
        this.maxSpawnEnergy = this.room.energyCapacityAvailable;
        this.manageSpawnLog();
        this.initSpawns();
        this.isAvailable = this.availabilityCheck();
        this.refillEfficiency = this.findRefillEfficiency();
    }

    public static finalize(spawnGroups: {[roomName: string]: SpawnGroup}) {
        for (let roomName in spawnGroups) {
            spawnGroups[roomName].finalize();
        }
    }

    private initMemory() {
        if (!this.room.memory.spawnMemory) { this.room.memory.spawnMemory = {}; }
        this.memory = this.room.memory.spawnMemory;
    }

    private initSpawns() {
        this.spawns = [];
        this.isAvailable = true;
        let idleSpawnCount = 0;
        for (let id of this.spawnIds) {
            let spawn = Game.getObjectById<StructureSpawn>(id);
            if (!spawn) {
                continue;
            }
            this.spawns.push(spawn);
            if (spawn.spawning === null) {
                idleSpawnCount++;
            }
        }
        this.idleSpawnCount = idleSpawnCount;
        this.memory.log.availability += idleSpawnCount;
        Memory.stats["spawnGroups." + this.room.name + ".idleCount"] = idleSpawnCount;
    }

    private availabilityCheck() {
        if (Game.time < this.memory.nextCheck) {
            return false;
        }
        return this.idleSpawnCount > 0;
    }

    public spawn (build: string[], name: string, memory?: any, reservation?: SpawnReservation): string | number {
        let outcome;
        this.isAvailable = false;
        if (reservation) {
            if (this.idleSpawnCount < reservation.spawns) { return ERR_BUSY; }
            if (this.currentSpawnEnergy < reservation.currentEnergy) { return ERR_NOT_ENOUGH_RESOURCES; }
        }
        for (let spawn of this.spawns) {
            if (spawn.spawning == null) {
                outcome = spawn.createCreep(build, name, memory);
                if (Memory.playerConfig.muteSpawn) { break; } // early

                if (outcome === ERR_INVALID_ARGS) {
                    console.log("SPAWN: invalid args for creep\nbuild:", build, "\nname:", name, "\ncount:",
                        build.length);
                }
                if (_.isString(outcome)) {
                    console.log("SPAWN: building " + name);
                } else if (outcome === ERR_NOT_ENOUGH_RESOURCES) {
                    if (Game.time % 10 === 0) {
                        console.log("SPAWN:", this.room.name, "not enough energy for", name, "cost:",
                            SpawnGroup.calculateBodyCost(build), "current:", this.currentSpawnEnergy, "max",
                            this.maxSpawnEnergy);
                    }
                } else if (outcome !== ERR_NAME_EXISTS) {
                    console.log("SPAWN:", this.room.name, "had error spawning " + name + ", outcome: " + outcome);
                } else if (outcome === ERR_RCL_NOT_ENOUGH) {
                    continue;
                }
                break;
            }
        }
        return outcome;
    }

    public static calculateBodyCost(body: string[]): number {
        let sum = 0;
        for (let part of body) {
            sum += BODYPART_COST[part];
        }
        return sum;
    }

    public canCreateCreep(body: string[]): boolean {
        let cost = SpawnGroup.calculateBodyCost(body);
        return cost <= this.currentSpawnEnergy;
    }

    // proportion allows you to scale down the body size if you don't want to use all of your spawning energy
    // for example, proportion of .5 would return the max units per cost if only want to use half of your spawn-capacity
    public maxUnitsPerCost(unitCost: number, proportion: number = 1): number {
        return Math.floor((this.maxSpawnEnergy * proportion) / unitCost);
    }

    public maxUnits(body: string[], proportion?: number) {
        let cost = SpawnGroup.calculateBodyCost(body);
        return Math.min(this.maxUnitsPerCost(cost, proportion), Math.floor(50 / body.length));
    }

    private manageSpawnLog() {
        if (!this.memory.log) { this.memory.log = {availability: 0, history: [], longHistory: []}; }

        if (Game.time % 100 !== 0) { return; }
        let log = this.memory.log;
        let average = log.availability / 100;
        log.availability = 0;
        log.history.push(average);
        while (log.history.length > 5) { log.history.shift(); }

        if (Game.time % 500 !== 0) { return; }
        let longAverage = _.sum(log.history) / 5;
        log.longHistory.push(longAverage);
        while (log.longHistory.length > 5) { log.longHistory.shift(); }
    }

    public showHistory() {
        console.log("Average availability in", this.room.name, "the last 5 creep generations (1500 ticks):");
        console.log(this.memory.log.history);
        console.log("Average availability over the last 75000 ticks (each represents a period of 15000 ticks)");
        console.log(this.memory.log.longHistory);
    }

    get averageAvailability(): number {
        if (this.memory.log.history.length === 0) {
            return .1;
        }
        return _.last(this.memory.log.history) as number;
    }

    public finalize() {
        if (this.isAvailable) {
            this.memory.nextCheck = Game.time + Scheduler.randomInterval(10);
        }
    }

    private findRefillEfficiency() {
        if (Math.random() > .2) { return; }
        if (this.memory.efficiency === undefined) {
            this.memory.efficiency = this.currentSpawnEnergy / this.maxSpawnEnergy;
        }

        let currentStatus = this.currentSpawnEnergy / this.maxSpawnEnergy;
        let lerp = (a: number, b: number, f: number) => a + f * (b - a);
        this.memory.efficiency = lerp(this.memory.efficiency, currentStatus, .1);
        return this.memory.efficiency;
    }
}

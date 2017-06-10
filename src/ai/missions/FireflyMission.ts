import {RaidMission} from "./RaidMission";
import {Operation} from "../operations/Operation";
import {RaidData, BoostLevel, RaidActionType, RaidAction} from "../../interfaces";
import {SpawnGroup} from "../SpawnGroup";
import {Agent} from "../agents/Agent";
import {RaidOperation} from "../operations/RaidOperation";
import {HostileAgent} from "../agents/HostileAgent";
import {helper} from "../../helpers/helper";
export class FireflyMission extends RaidMission {

    constructor(operation: RaidOperation, name: string, raidData: RaidData, spawnGroup: SpawnGroup, boostLevel: number,
                allowSpawn: boolean) {
        super(operation, name, raidData, spawnGroup, boostLevel, allowSpawn);
        this.specialistPart = RANGED_ATTACK;
        this.specialistBoost = RESOURCE_CATALYZED_KEANIUM_ALKALIDE;
        this.spawnCost = 12440;
        this.attackRange = 3;
        this.attackerBoosts = {
            [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: true,
            [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]: true,
            [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: true,
        };
    }

    protected clearActions() {

        let fleeing = this.squadFlee();
        if (fleeing) { return; }

        super.clearActions();
    }

    protected attackerBody = (): string[] => {
        let boostMap = {
            [BoostLevel.Training]: this.configBody({ [TOUGH]: 1, [MOVE]: 2, [RANGED_ATTACK]: 1 }),
            [BoostLevel.Unboosted]: this.configBody({ [TOUGH]: 5, [MOVE]: 25, [RANGED_ATTACK]: 20 }),
            [BoostLevel.Standard]: this.configBody({ [TOUGH]: 12, [MOVE]: 10, [RANGED_ATTACK]: 28}),
            [BoostLevel.SuperTough]: this.configBody({ [TOUGH]: 16, [MOVE]: 10, [RANGED_ATTACK]: 20, [HEAL]: 4 }),
            [BoostLevel.RCL7]: this.configBody({ [TOUGH]: 12, [MOVE]: 8, [RANGED_ATTACK]: 20 }),
        };

        if (boostMap[this.boostLevel]) {
            return boostMap[this.boostLevel];
        } else {
            return boostMap[BoostLevel.Standard];
        }
    };

    protected getHeadhunterAction(hostileAgents: HostileAgent[]): RaidAction {
        let nearest = this.attacker.pos.findClosestByRange(hostileAgents);
        if (!nearest || (nearest.room !== this.raidData.attackRoom && nearest.pos.getRangeTo(this.attacker) > 4)
            && nearest.pos.lookForStructure(STRUCTURE_RAMPART)
            || !this.hasValidPath(this.attacker, nearest)) { return; }

        return {
            type: RaidActionType.Headhunter,
            id: nearest.id,
        };
    }

    protected headhunting() {
        let action = this.getSpecialAction();
        let creep = Game.getObjectById<Creep>(action.id);
        if (!this.continueHeadHunting(creep)) {
            this.setSpecialAction(undefined);
            this.squadFlee();
            return;
        }

        let fleeing = this.squadFlee();
        if (fleeing) { return; }

        let hostileAgent = new HostileAgent(creep);
        if (this.attacker.pos.inRangeTo(hostileAgent, 3)) { return; }
        this.squadTravel(this.attacker, this.healer, hostileAgent);
    }

    private continueHeadHunting(creep: Creep) {
        if (!creep) { return false; }
        if (creep.pos.lookForStructure(STRUCTURE_RAMPART)) { return false; }
        if (!this.state.inSameRoom) { return false; }
        if (creep.room === this.raidData.attackRoom &&
            creep.pos.getRangeToClosest(this.raidData.attackRoom.findStructures<Structure>(STRUCTURE_TOWER)) < 15) {
            return false;
        }
        return true;
    }
}

export class Scheduler {

    /**
     * Returns false every x ticks (on average) when CPU is below 250.
     * @param memoryHost
     * @param taskName
     * @param interval
     * @returns {boolean}
     */

    public static delay(memoryHost: {memory: any}, taskName: string, interval: number): boolean {
        if (Game.cpu.getUsed() > 250) { return true; }
        if (Game.time < memoryHost.memory[taskName]) { return true; }
        memoryHost.memory[taskName] = Game.time + Scheduler.randomInterval(interval);
        return false;
    }

    public static randomInterval(interval: number): number {
        return interval + Math.floor((Math.random() - .5) * interval * .2);
    }

    public static nextTick(memoryHost: {memory: any}, taskName: string) {
        memoryHost.memory[taskName] = Game.time + 1;
    }
}

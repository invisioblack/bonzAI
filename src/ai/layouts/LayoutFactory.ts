import {QuadLayout} from "./QuadLayout";
import {
    Layout, LAYOUT_CUSTOM, LAYOUT_FLEX, LAYOUT_MINI, LAYOUT_QUAD, LAYOUT_SWAP, LayoutData,
} from "./Layout";
import {MiniLayout} from "./MiniLayout";
import {FlexLayout} from "./FlexLayout";
import {CustomLayout} from "./CustomLayout";
import {SwapLayout} from "./SwapLayout";
export class LayoutFactory {

    public static layoutClasses = {
        [LAYOUT_QUAD]: QuadLayout,
        [LAYOUT_MINI]: MiniLayout,
        [LAYOUT_FLEX]: FlexLayout,
        [LAYOUT_SWAP]: SwapLayout,
        [LAYOUT_CUSTOM]: CustomLayout,
    };

    public static Instantiate(roomName: string, data?: LayoutData): Layout {
        if (!data) {
            if (!Memory.rooms[roomName]) { Memory.rooms[roomName] = {} as any; }
            data = Memory.rooms[roomName].layout;
            if (!data) {
                if (Game.time % 10 === 0) {
                    console.log(`LAYOUT: no auto-layout type specified for ${roomName}`);
                }
                data = {
                    flex: true,
                    anchor: {x: 0, y: 0},
                    rotation: 0,
                    type: LAYOUT_CUSTOM,
                };
            }
        }
        let layoutClass = LayoutFactory.layoutClasses[data.type];
        return new layoutClass(roomName, data);
    }
}

import type { AppMode, ControlPanelName } from '../types/domain';

export type AppIntent =
  | {
      type: 'mode/select';
      mode: AppMode | string | null | undefined;
    }
  | {
      type: 'mode/switch';
    }
  | {
      type: 'panel/select';
      panelName: ControlPanelName | string | null | undefined;
    }
  | {
      type: 'bottom-sheet/toggle';
    }
  | {
      type: 'bottom-sheet/set';
      controlsCollapsed: boolean;
    }
  | {
      type: 'debug/toggle';
      isEnabled: boolean;
    }
  | {
      type: 'necklace-visibility/toggle';
      isVisible: boolean;
    };

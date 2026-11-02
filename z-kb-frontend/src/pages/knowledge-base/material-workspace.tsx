import type { CSSProperties } from 'react';
import MaterialTreePanel from './components/material-tree-panel';
import MaterialListPanel from './components/material-list-panel';
import MaterialDetailPanel from './components/material-detail-panel';
import MaterialWorkspaceDialogs from './components/material-workspace-dialogs';
import SourceSyncDrawer from './components/source-sync-drawer';
import { useMaterialWorkspace } from './hooks/use-material-workspace';
import { useSourceSyncDrawer } from './hooks/use-source-sync-drawer';
import { useSplitWidth } from './hooks/use-split-width';
import type { MaterialWorkspaceProps } from './material-workspace-model';

export default function MaterialWorkspace(props: MaterialWorkspaceProps) {
  const ctrl = useMaterialWorkspace(props);
  const sourceSync = useSourceSyncDrawer(props.kbId);
  const { width, containerRef, startResize, resetWidth } = useSplitWidth({
    storageKey: 'kb.materialTreeWidth',
    defaultWidth: 225,
    minWidth: 180,
    maxWidth: 420,
  });
  return (
    <div
      className="side-layout side-layout-split"
      ref={containerRef}
      style={{ '--split-w': `${width}px` } as CSSProperties}
    >
      <MaterialTreePanel ctrl={ctrl} onSyncSource={sourceSync.open} />
      <div
        className="split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整资料树宽度"
        title="拖动调整资料树宽度，双击复位"
        onPointerDown={startResize}
        onDoubleClick={resetWidth}
      />
      <div className="side-layout-main">
        {ctrl.detailId ? <MaterialDetailPanel ctrl={ctrl} /> : <MaterialListPanel ctrl={ctrl} />}
      </div>
      <MaterialWorkspaceDialogs ctrl={ctrl} />
      <SourceSyncDrawer sync={sourceSync} />
    </div>
  );
}

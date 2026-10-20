import React from 'react';
import Icon from './Icon';
import './ActivityBar.css';

export type ActivityView = 'explorer' | 'environment' | 'docs' | 'settings' | null;

interface ActivityBarProps {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
}

// Map activity view → codicon name. Centralised so adding a new panel
// (e.g. run-history in Phase E) is a one-line change here.
const ACTIVITY_ICONS: Record<Exclude<ActivityView, null>, string> = {
  explorer: 'files',
  environment: 'server-environment',
  docs: 'book',
  settings: 'settings-gear',
};

const ICON_SIZE = 24;

interface ItemProps {
  view: Exclude<ActivityView, null>;
  active: boolean;
  label: string;
  onClick: (view: ActivityView) => void;
}

const ActivityItem: React.FC<ItemProps> = ({ view, active, label, onClick }) => (
  <div
    className={`activity-item ${active ? 'active' : ''}`}
    onClick={() => onClick(view)}
    title={label}
    role="button"
    tabIndex={0}
  >
    <Icon name={ACTIVITY_ICONS[view]} size={ICON_SIZE} title={label} />
  </div>
);

const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onViewChange }) => {
  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        <ActivityItem view="explorer" active={activeView === 'explorer'} label="Explorer" onClick={onViewChange} />
        <ActivityItem view="environment" active={activeView === 'environment'} label="Environment — tools & resources" onClick={onViewChange} />
        <ActivityItem view="docs"     active={activeView === 'docs'}     label="User Docs" onClick={onViewChange} />
      </div>

      <div className="activity-bar-bottom">
        <ActivityItem view="settings" active={activeView === 'settings'} label="Settings" onClick={onViewChange} />
      </div>
    </div>
  );
};

export default ActivityBar;

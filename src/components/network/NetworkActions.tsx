import React, { ReactNode, useCallback, useState } from 'react';
import { useAsyncCallback } from 'react-async-hook';
import {
  CloseOutlined,
  ExportOutlined,
  FormOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  RetweetOutlined,
  StopOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import styled from '@emotion/styled';
import {
  Button,
  Divider,
  Dropdown,
  MenuProps,
  Tag,
  InputNumber,
  Tooltip,
  Space,
} from 'antd';
import { ButtonType } from 'antd/lib/button';
import { usePrefixedTranslation } from 'hooks';
import { Status } from 'shared/types';
import { useStoreActions, useStoreState } from 'store';
import { Network } from 'types';
import SyncButton from 'components/designer/SyncButton';

const Styled = {
  Button: styled(Button)`
    margin-left: 0;
  `,
  Dropdown: styled(Dropdown)`
    margin-left: 12px;
  `,
  InputNumber: styled(InputNumber)`
    width: 60px;
  `,
  AutoMineGroup: styled(Space.Compact)`
    margin-right: 12px;
  `,
  Labels: styled(Space.Compact)`
    vertical-align: middle;
  `,
};

interface Props {
  network: Network;
  onClick: () => void;
  onRenameClick: () => void;
  onDeleteClick: () => void;
  onExportClick: () => void;
}

const config: {
  [key: number]: {
    label: string;
    type: ButtonType;
    danger?: boolean;
    icon: ReactNode;
  };
} = {
  [Status.Starting]: {
    label: 'Starting',
    type: 'primary',
    icon: '',
  },
  [Status.Started]: {
    label: 'Stop',
    type: 'primary',
    danger: true,
    icon: <StopOutlined />,
  },
  [Status.Stopping]: {
    label: 'Stopping',
    type: 'default',
    icon: '',
  },
  [Status.Stopped]: {
    label: 'Start',
    type: 'primary',
    icon: <PlayCircleOutlined />,
  },
  [Status.Error]: {
    label: 'Restart',
    type: 'primary',
    danger: true,
    icon: <WarningOutlined />,
  },
};

const NetworkActions: React.FC<Props> = ({
  network,
  onClick,
  onRenameClick,
  onDeleteClick,
  onExportClick,
}) => {
  const { l } = usePrefixedTranslation('cmps.network.NetworkActions');

  const { status, nodes } = network;
  const bitcoinNode = nodes.bitcoin[0];
  const loading = status === Status.Starting || status === Status.Stopping;
  const started = status === Status.Started;
  const { label, type, danger, icon } = config[status];

  const nodeState = useStoreState(s => s.bitcoind.nodes[bitcoinNode.name]);
  const { notify } = useStoreActions(s => s.app);
  const { mine, intervalMine } = useStoreActions(s => s.bitcoind);
  const mineAsync = useAsyncCallback(async () => {
    try {
      await mine({ blocks: 1, node: bitcoinNode });
    } catch (error: any) {
      notify({ message: l('mineError'), error });
    }
  });
  const startIntervalMineAsync = useAsyncCallback(async () => {
    try {
      if (!mineIntervalMin) {
        throw new Error(l('mineIntervalNotSetError'));
      }
      await intervalMine({ intervalMin: mineIntervalMin, node: bitcoinNode });
    } catch (error: any) {
      notify({ message: l('mineError'), error });
    }
  });
  const stopIntervalMineAsync = useAsyncCallback(async () => {
    try {
      intervalMine({ intervalMin: 0, node: bitcoinNode });
    } catch (error: any) {
      notify({ message: l('mineError'), error });
    }
  });
  const [mineIntervalMin, setMineIntervalMin] = useState(10);

  const handleClick: MenuProps['onClick'] = useCallback(info => {
    switch (info.key) {
      case 'rename':
        onRenameClick();
        break;
      case 'export':
        onExportClick();
        break;
      case 'delete':
        onDeleteClick();
        break;
    }
  }, []);

  const items: MenuProps['items'] = [
    { key: 'rename', label: l('menuRename'), icon: <FormOutlined /> },
    { key: 'export', label: l('menuExport'), icon: <ExportOutlined /> },
    { key: 'delete', label: l('menuDelete'), icon: <CloseOutlined /> },
  ];

  return (
    <>
      {bitcoinNode.status === Status.Started && nodeState && nodeState.chainInfo && (
        <>
          <Styled.Labels direction="vertical">
            <Tag>
              {l('blockHeight')}: {nodeState.chainInfo.blocks}
            </Tag>
            {nodeState.mineIntervalId && (
              <Tag color={'green'}>
                {l('mining')}: {l('active')} ({mineIntervalMin} min)
              </Tag>
            )}
            {!nodeState.mineIntervalId && (
              <Tag color={'red'}>
                {l('mining')}: {l('inactive')}
              </Tag>
            )}
          </Styled.Labels>

          <Styled.AutoMineGroup>
            {!nodeState.mineIntervalId && (
              <>
                <Styled.Button
                  onClick={startIntervalMineAsync.execute}
                  icon={<RetweetOutlined />}
                >
                  Auto Mine
                </Styled.Button>
                <Tooltip title={<span>{l('blocktimeAutoMine')}</span>}>
                  <Styled.InputNumber
                    value={mineIntervalMin}
                    max="999"
                    min="1"
                    parser={i => parseInt(`${i}`.replace(/(undefined|,*)/g, ''))}
                    onChange={i => setMineIntervalMin(i as number)}
                  />
                </Tooltip>
              </>
            )}
            {nodeState.mineIntervalId && (
              <Styled.Button
                onClick={stopIntervalMineAsync.execute}
                icon={<StopOutlined />}
              >
                {l('stopAutoMine')}
              </Styled.Button>
            )}
          </Styled.AutoMineGroup>

          <Tooltip title={<span>{l('mineOneBlock')}</span>}>
            <Button
              onClick={mineAsync.execute}
              loading={mineAsync.loading}
              icon={<ToolOutlined />}
            >
              {l('mineBtn')}
            </Button>
          </Tooltip>
          <SyncButton network={network} />
          <Divider type="vertical" />
        </>
      )}
      <Styled.Button
        key="start"
        type={type}
        danger={danger}
        icon={icon}
        loading={loading}
        ghost={started}
        onClick={onClick}
      >
        {l(`primaryBtn${label}`)}
      </Styled.Button>
      <Styled.Dropdown
        key="options"
        menu={{ theme: 'dark', items, onClick: handleClick }}
      >
        <Button icon={<MoreOutlined />} />
      </Styled.Dropdown>
    </>
  );
};

export default NetworkActions;

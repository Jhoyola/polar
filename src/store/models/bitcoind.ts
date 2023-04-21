import { ChainInfo, WalletInfo } from 'bitcoin-core';
import { Action, action, Thunk, thunk } from 'easy-peasy';
import { BitcoinNode, Status } from 'shared/types';
import { StoreInjections } from 'types';
import { delay } from 'utils/async';
import { prefixTranslation } from 'utils/translate';
import { RootModel } from './';

const { l } = prefixTranslation('store.models.bitcoind');

export interface BitcoindNodeMapping {
  [key: string]: BitcoindNodeModel;
}

export interface BitcoindNodeModel {
  chainInfo?: ChainInfo;
  walletInfo?: WalletInfo;
  mineIntervalId?: NodeJS.Timer;
}

export interface BitcoindModel {
  nodes: BitcoindNodeMapping;
  removeNode: Action<BitcoindModel, string>;
  clearNodes: Action<BitcoindModel, void>;
  setInfo: Action<
    BitcoindModel,
    { node: BitcoinNode; chainInfo: ChainInfo; walletInfo: WalletInfo }
  >;
  setMineInterval: Action<
    BitcoindModel,
    { node: BitcoinNode; mineIntervalId?: NodeJS.Timer }
  >;
  getInfo: Thunk<BitcoindModel, BitcoinNode, StoreInjections>;
  mine: Thunk<
    BitcoindModel,
    { blocks: number; node: BitcoinNode },
    StoreInjections,
    RootModel
  >;
  intervalMine: Thunk<
    BitcoindModel,
    { intervalMin: number; node: BitcoinNode },
    StoreInjections,
    RootModel
  >;
  sendFunds: Thunk<
    BitcoindModel,
    { node: BitcoinNode; toAddress: string; amount: number; autoMine: boolean },
    StoreInjections,
    RootModel,
    Promise<string>
  >;
}

const bitcoindModel: BitcoindModel = {
  // computed properties/functions
  nodes: {},
  // reducer actions (mutations allowed thx to immer)
  removeNode: action((state, name) => {
    delete state.nodes[name];
  }),
  clearNodes: action(state => {
    state.nodes = {};
  }),
  setInfo: action((state, { node, chainInfo, walletInfo }) => {
    if (!state.nodes[node.name]) state.nodes[node.name] = {};
    state.nodes[node.name].chainInfo = chainInfo;
    state.nodes[node.name].walletInfo = walletInfo;
  }),
  setMineInterval: action((state, { node, mineIntervalId }) => {
    state.nodes[node.name].mineIntervalId = mineIntervalId;
  }),
  getInfo: thunk(async (actions, node, { injections }) => {
    const chainInfo = await injections.bitcoindService.getBlockchainInfo(node);
    const walletInfo = await injections.bitcoindService.getWalletInfo(node);
    actions.setInfo({ node, chainInfo, walletInfo });
  }),
  mine: thunk(async (actions, { blocks, node }, { injections, getStoreState }) => {
    if (blocks < 0) throw new Error(l('mineError'));

    await injections.bitcoindService.mine(blocks, node);
    // add a small delay to allow the block to propagate to all nodes
    await delay(500);
    // update info for all bitcoin nodes
    const network = getStoreState().network.networkById(node.networkId);
    await Promise.all(
      network.nodes.bitcoin.filter(n => n.status === Status.Started).map(actions.getInfo),
    );
  }),
  intervalMine: thunk(async (actions, { intervalMin, node }, { getStoreState }) => {
    // clear the interval
    const oldIntervalId = getStoreState().bitcoind.nodes[node.name].mineIntervalId;
    if (oldIntervalId) {
      clearInterval(oldIntervalId);
      actions.setMineInterval({ node });
    }

    // don't mine if mining stopped
    if (intervalMin == 0) {
      return;
    }

    const blocks = 1;
    const mineIntervalId = setInterval(async () => {
      await actions.mine({ blocks, node });
    }, intervalMin * 60 * 1000);

    // save the interval variable
    actions.setMineInterval({ node, mineIntervalId });
  }),
  sendFunds: thunk(
    async (actions, { node, toAddress, amount, autoMine }, { injections }) => {
      const txid = await injections.bitcoindService.sendFunds(node, toAddress, amount);
      if (autoMine) await actions.mine({ blocks: 6, node });
      return txid;
    },
  ),
};

export default bitcoindModel;

import React, { useState, createContext } from 'react';
import Pact from 'pact-lang-api';
import moment from 'moment';
import tokenData from '../constants/cryptoCurrencies';
import { reduceBalance } from '../utils/reduceBalance';
import { STATUSES } from './NotificationContext';
import { useKaddexWalletContext, useWalletContext, useAccountContext, usePactContext, useNotificationContext } from '.';
import {
  CHAIN_ID,
  creationTime,
  GAS_PRICE,
  NETWORK,
  NETWORKID,
  ENABLE_GAS_STATION,
  KADDEX_NAMESPACE,
  GAS_LIMIT,
} from '../constants/contextConstants';
import { pactFetchLocal } from '../api/pact';
import { mkReq, parseRes } from '../api/utils';

export const SwapContext = createContext();

export const SwapProvider = (props) => {
  const pact = usePactContext();
  const notificationContext = useNotificationContext();
  const { account, localRes, setLocalRes, storeNotification } = useAccountContext();
  const { isConnected: isKaddexWalletConnected, requestSign: kaddexWalletRequestSign } = useKaddexWalletContext();

  const wallet = useWalletContext();
  const [pairAccount, setPairAccount] = useState('');
  const [cmd, setCmd] = useState(null);

  const toastId = React.useRef(null);

  const getPairAccount = async (token0, token1) => {
    const result = await pactFetchLocal(`(at 'account (${KADDEX_NAMESPACE}.exchange.get-pair ${token0} ${token1}))`);
    if (result.errorMessage) {
      return result.errorMessage;
    } else {
      setPairAccount(result);
      return result;
    }
  };

  const swap = async (token0, token1, isSwapIn) => {
    try {
      let pair = await getPairAccount(token0.address, token1.address);

      const inPactCode = `(${KADDEX_NAMESPACE}.exchange.swap-exact-in
          (read-decimal 'token0Amount)
          (read-decimal 'token1AmountWithSlippage)
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
        )`;
      const outPactCode = `(${KADDEX_NAMESPACE}.exchange.swap-exact-out
          (read-decimal 'token1Amount)
          (read-decimal 'token0AmountWithSlippage)
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
        )`;
      const cmd = {
        pactCode: isSwapIn ? inPactCode : outPactCode,
        keyPairs: {
          publicKey: account.guard.keys[0],
          secretKey: wallet.privKey,
          clist: [
            {
              name: `${token0.address}.TRANSFER`,
              args: [
                account.account,
                pair,
                isSwapIn
                  ? reduceBalance(token0.amount, tokenData[token0.coin].precision)
                  : reduceBalance(token0.amount * (1 + parseFloat(pact.slippage)), tokenData[token0.coin].precision),
              ],
            },
          ],
        },
        envData: {
          'user-ks': account.guard,
          token0Amount: reduceBalance(token0.amount, tokenData[token0.coin].precision),
          token1Amount: reduceBalance(token1.amount, tokenData[token1.coin].precision),
          token1AmountWithSlippage: reduceBalance(token1.amount * (1 - parseFloat(pact.slippage)), tokenData[token1.coin].precision),
          token0AmountWithSlippage: reduceBalance(token0.amount * (1 + parseFloat(pact.slippage)), tokenData[token0.coin].precision),
        },
        // meta: Pact.lang.mkMeta('', '', 0, 0, 0, 0),
        networkId: NETWORKID,
        meta: Pact.lang.mkMeta(account.account, CHAIN_ID, GAS_PRICE, GAS_LIMIT, creationTime(), 600),
      };
      setCmd(cmd);
      await Pact.fetch.send(cmd, NETWORK);
    } catch (e) {
      console.log(e);
    }
  };

  const swapSend = async () => {
    pact.setPolling(true);
    try {
      let data;
      if (cmd.pactCode) {
        data = await Pact.fetch.send(cmd, NETWORK);
      } else {
        data = await Pact.wallet.sendSigned(cmd, NETWORK);
      }
      pact.pollingNotif(data.requestKeys[0]);
      storeNotification({
        type: 'info',
        date: moment().format('DD/MM/YYYY - HH:mm:ss'),

        title: 'Transaction Pending',
        description: data.requestKeys[0],
        isRead: false,
        isCompleted: false,
      });

      await pact.listen(data.requestKeys[0]);
      pact.setPolling(false);
    } catch (e) {
      console.log('e', e);
      pact.setPolling(false);
      toastId.current = notificationContext.showNotification({
        title: 'Transaction Error',
        message: 'Insufficient funds - attempt to buy gas failed.',
        type: STATUSES.ERROR,
        autoClose: 5000,
        hideProgressBar: true,
      });
      storeNotification({
        type: 'error',
        date: moment().format('DD/MM/YYYY - HH:mm:ss'),

        title: 'Transaction Error',
        description: 'Insufficient funds - attempt to buy gas failed.',
        isRead: false,
        isCompleted: false,
      });
      console.log('error', e);
    }
  };

  const swapWallet = async (token0, token1, isSwapIn) => {
    try {
      const inPactCode = `(${KADDEX_NAMESPACE}.exchange.swap-exact-in
          (read-decimal 'token0Amount)
          (read-decimal 'token1AmountWithSlippage)
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
        )`;
      const outPactCode = `(${KADDEX_NAMESPACE}.exchange.swap-exact-out
          (read-decimal 'token1Amount)
          (read-decimal 'token0AmountWithSlippage)
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
        )`;
      const signCmd = {
        pactCode: isSwapIn ? inPactCode : outPactCode,
        caps: [
          ...(ENABLE_GAS_STATION
            ? [Pact.lang.mkCap('Gas Station', 'free gas', `${KADDEX_NAMESPACE}.gas-station.GAS_PAYER`, ['free-gas', { int: 1 }, 1.0])]
            : []),
          Pact.lang.mkCap('transfer capability', 'trasnsfer token in', `${token0.address}.TRANSFER`, [
            account.account,
            pact.pair.account,
            isSwapIn
              ? reduceBalance(token0.amount, tokenData[token0.coin].precision)
              : reduceBalance(token0.amount * (1 + parseFloat(pact.slippage)), tokenData[token0.coin].precision),
          ]),
          ...(!ENABLE_GAS_STATION ? [Pact.lang.mkCap('gas', 'pay gas', 'coin.GAS')] : []),
        ],
        sender: ENABLE_GAS_STATION ? 'kaddex-free-gas' : account.account,
        gasLimit: GAS_LIMIT,
        gasPrice: GAS_PRICE,
        chainId: CHAIN_ID,
        ttl: 600,
        envData: {
          'user-ks': account.guard,
          token0Amount: reduceBalance(token0.amount, tokenData[token0.coin].precision),
          token1Amount: reduceBalance(token1.amount, tokenData[token1.coin].precision),
          token0AmountWithSlippage: reduceBalance(token0.amount * (1 + parseFloat(pact.slippage)), tokenData[token0.coin].precision),
          token1AmountWithSlippage: reduceBalance(token1.amount * (1 - parseFloat(pact.slippage)), tokenData[token1.coin].precision),
        },
        signingPubKey: account.guard.keys[0],
        networkId: NETWORKID,
      };
      //alert to sign tx
      /* walletLoading(); */
      wallet.setIsWaitingForWalletAuth(true);
      let command = null;
      if (isKaddexWalletConnected) {
        const res = await kaddexWalletRequestSign(signCmd);
        command = res.signedCmd;
      } else {
        command = await Pact.wallet.sign(signCmd);
      }
      //close alert programmatically
      /* swal.close(); */
      wallet.setIsWaitingForWalletAuth(false);
      wallet.setWalletSuccess(true);
      //set signedtx
      setCmd(command);
      let data = await fetch(`${NETWORK}/api/v1/local`, mkReq(command));
      data = await parseRes(data);
      setLocalRes(data);
      return data;
    } catch (e) {
      //wallet error alert
      /* setLocalRes({}); */
      if (e.message.includes('Failed to fetch'))
        wallet.setWalletError({
          error: true,
          title: 'No Wallet',
          content: 'Please make sure you open and login to your wallet.',
        });
      //walletError();
      else
        wallet.setWalletError({
          error: true,
          title: 'Wallet Signing Failure',
          content:
            'You cancelled the transaction or did not sign it correctly. Please make sure you sign with the keys of the account linked in Kaddex.',
        }); //walletSigError();
      console.log(e);
    }
  };
  return (
    <SwapContext.Provider
      value={{
        swap,
        pairAccount,
        getPairAccount,
        swapSend,
        swapWallet,
        tokenData,
        localRes,
        cmd,
        setCmd,
        mkReq,
        parseRes,
      }}
    >
      {props.children}
    </SwapContext.Provider>
  );
};

export const SwapConsumer = SwapContext.Consumer;

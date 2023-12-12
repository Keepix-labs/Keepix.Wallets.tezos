import { TezosToolkit } from '@taquito/taquito'
import { InMemorySigner } from '@taquito/signer'
import { getPkhfromPk } from '@taquito/utils'
import { entropyToMnemonic, generateMnemonic } from 'bip39-light'
import { Tzip12Module, tzip12 } from '@taquito/tzip12'
import { BigNumber } from 'bignumber.js'

type NETWORK = 'mainnet' | 'testnet'

function createPrivateKey(templatePrivateKey: string, password: string) {
  const crypto = require('crypto')
  const hash = crypto
    .createHash('sha256')
    .update(templatePrivateKey + password, 'utf8')
    .digest('hex')
  return hash.substring(0, 64) // Truncate to 64 characters (32 bytes)
}

function format(from: number, to: number, amount: number | string | BigNumber) {
  const bigNum = new BigNumber(amount)
  if (bigNum.isNaN()) {
    return amount
  }

  return bigNum.multipliedBy(Math.pow(10, from)).dividedBy(Math.pow(10, to))
}

/**
 * Wallet class who respect the WalletLibraryInterface for Keepix
 */
export class Wallet {
  private networkId?: NETWORK
  private wallet?: TezosToolkit
  private mnemonic?: string
  private type?: string
  private keepixTokens?: { coins: any; tokens: any }
  private rpc?: any
  private privateKey?: string
  private publicKey?: string

  constructor() {}

  public async init({
    networkId,
    password,
    mnemonic,
    privateKey,
    type,
    keepixTokens,
    rpc,
    privateKeyTemplate = '0x2050939757b6d498bb0407e001f0cb6db05c991b3c6f7d8e362f9d27c70128b9',
  }: {
    networkId: NETWORK
    password?: string
    mnemonic?: string
    privateKey?: string
    type: string
    keepixTokens?: { coins: any; tokens: any } // whitelisted coins & tokens
    rpc?: any
    privateKeyTemplate?: string
  }) {
    this.type = type
    this.keepixTokens = keepixTokens
    this.rpc = rpc
    this.networkId = networkId

    this.wallet = new TezosToolkit(rpc)
    this.wallet.addExtension(new Tzip12Module())

    // from password
    if (password !== undefined) {
      const newPrivateKey = createPrivateKey(privateKeyTemplate, password)
      this.mnemonic = entropyToMnemonic(newPrivateKey)
      this.wallet.setProvider({
        signer: await InMemorySigner.fromMnemonic({ mnemonic: this.mnemonic }),
      })
      this.privateKey = await this.wallet.signer.secretKey()
      this.publicKey = await this.wallet.signer.publicKey()
      return
    }
    // from mnemonic
    if (mnemonic !== undefined) {
      this.mnemonic = mnemonic
      this.wallet.setProvider({
        signer: await InMemorySigner.fromMnemonic({ mnemonic }),
      })
      this.privateKey = await this.wallet.signer.secretKey()
      this.publicKey = await this.wallet.signer.publicKey()
      return
    }
    // from privateKey only
    if (privateKey !== undefined) {
      this.mnemonic = undefined
      this.wallet.setProvider({
        signer: await InMemorySigner.fromSecretKey(privateKey),
      })
      this.privateKey = await this.wallet.signer.secretKey()
      this.publicKey = await this.wallet.signer.publicKey()
      return
    }
    // Random
    this.mnemonic = generateMnemonic(256)
    this.wallet.setProvider({
      signer: await InMemorySigner.fromMnemonic({ mnemonic: this.mnemonic }),
    })
    this.privateKey = await this.wallet.signer.secretKey()
    this.publicKey = await this.wallet.signer.publicKey()
  }

  // PUBLIC

  public getPrivateKey() {
    if (!this.wallet) throw new Error('Not initialized')
    return this.privateKey
  }

  public getMnemonic() {
    if (!this.wallet) throw new Error('Not initialized')
    return this.mnemonic
  }

  public getAddress() {
    if (!this.wallet) throw new Error('Not initialized')
    return getPkhfromPk(this.publicKey ?? '')
  }

  public getProdiver() {
    const Tezos = new TezosToolkit(this.rpc)
    return Tezos
  }

  public getConnectedWallet() {
    return this.wallet
  }

  // always display the balance in 0 decimals like 1.01 XTZ
  public async getCoinBalance(walletAddress?: string) {
    if (!this.wallet) throw new Error('Not initialized')

    try {
      const balance = await this.wallet.tz.getBalance(
        walletAddress ?? this.getAddress(),
      )
      return format(0, 6, balance).toString()
    } catch (err) {
      console.log(err)
      return '0'
    }
  }

  // always display the balance in 0 decimals like 1.01 RPL
  public async getTokenBalance(tokenAddress: string, walletAddress?: string) {
    if (!this.wallet) throw new Error('Not initialized')

    try {
      const contract = await this.wallet.contract.at(tokenAddress, tzip12)
      const metadata = await contract.tzip12().getTokenMetadata(0)

      let balance = '0'
      if (Boolean(contract.views.balance_of)) {
        balance = (
          await contract.views
            .balance_of([
              { owner: walletAddress ?? this.getAddress(), token_id: '0' },
            ])
            .read()
        )[0].balance
      } else if (Boolean(contract.views.getBalance)) {
        balance = await contract.views
          .getBalance(walletAddress ?? this.getAddress())
          .read()
      }

      return format(0, metadata.decimals, balance).toString()
    } catch (err) {
      console.log(err)
      return '0'
    }
  }

  public async estimateCostSendCoinTo(receiverAddress: string, amount: string) {
    if (!this.wallet) throw new Error('Not initialized')
    try {
      const estimation = await this.wallet.estimate.transfer({
        to: receiverAddress,
        amount: parseFloat(amount),
      })
      return { success: true, description: estimation.totalCost }
    } catch (err) {
      console.log(err)
      return { success: false, description: `Estimation Failed: ${err}` }
    }
  }

  public async sendCoinTo(receiverAddress: string, amount: string) {
    if (!this.wallet) throw new Error('Not initialized')

    try {
      const tx = await this.wallet.contract.transfer({
        to: receiverAddress,
        amount: parseFloat(amount),
      })
      await tx.confirmation()
      return { success: true, description: tx.hash }
    } catch (err) {
      console.log(err)
      return { success: false, description: `Transaction Failed: ${err}` }
    }
  }

  public async sendTokenTo(
    tokenAddress: string,
    receiverAddress: string,
    amount: string,
  ) {
    if (!this.wallet) throw new Error('Not initialized')

    try {
      const contract = await this.wallet.contract.at(tokenAddress, tzip12)
      const metadata = await contract.tzip12().getTokenMetadata(0)
      const parsedAmount = format(metadata.decimals, 0, amount)

      let tx: any
      if (Boolean(contract.views.balance_of)) {
        tx = await contract.methods
          .transfer([
            {
              from_: this.getAddress(),
              txs: [
                { to_: receiverAddress, amount: parsedAmount, token_id: 0 },
              ],
            },
          ])
          .send()
      } else if (Boolean(contract.views.getBalance)) {
        tx = await contract.methods
          .transfer(this.getAddress(), receiverAddress, parsedAmount)
          .send()
      }
      if (tx) {
        await tx.confirmation()
        return { success: true, description: tx.hash }
      } else {
        return { success: false, description: 'Transaction Failed' }
      }
    } catch (err) {
      console.log(err)
      return { success: false, description: `Transaction Failed: ${err}` }
    }
  }

  public async estimateCostSendTokenTo(
    tokenAddress: string,
    receiverAddress: string,
    amount: string,
  ) {
    if (!this.wallet) throw new Error('Not initialized')

    try {
      const contract = await this.wallet.contract.at(tokenAddress, tzip12)
      const metadata = await contract.tzip12().getTokenMetadata(0)
      const parsedAmount = format(metadata.decimals, 0, amount)

      let tx: any
      if (Boolean(contract.views.balance_of)) {
        tx = contract.methods.transfer([
          {
            from_: this.getAddress(),
            txs: [{ to_: receiverAddress, amount: parsedAmount, token_id: 0 }],
          },
        ])
      } else if (Boolean(contract.views.getBalance)) {
        tx = contract.methods.transfer(
          this.getAddress(),
          receiverAddress,
          parsedAmount,
        )
      }
      const estimation = await this.wallet.estimate.contractCall(tx)
      return { success: true, description: estimation.totalCost }
    } catch (err) {
      return { success: false, description: `Transaction Failed: ${err}` }
    }
  }
}

import { Wallet } from './Wallet'

describe('basic wallet', () => {
  const mnemonic =
    'radar volcano taxi ankle exhaust island double useless recall bracket hip popular lottery recall fork welcome solve evidence hurry clever text life rail maximum'
  const privateKey =
    'edskS14HjQsJwJXhFCBA8uHqBjvBTewdSaU8qBXvzc7VvrzCXSE5iy2U9F5tHNhctwNNJzw7cFby6T5Duv2G1rC71gcmqS1ky1'
  const address = 'tz1YrqoV1tDBUcz79vkVTPg7vQRmJp4ZDhtg'

  it('can generate same wallet', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
      password: '12',
    })
    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toEqual(mnemonic)
  })

  it('can generate with Mnemonic', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
      mnemonic,
    })

    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toEqual(mnemonic)
  })

  it('can generate with PrivateKey', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
      privateKey,
    })

    expect(wallet.getAddress()).toEqual(address)
    expect(wallet.getPrivateKey()).toEqual(privateKey)
    expect(wallet.getMnemonic()).toBe(undefined)
  })

  it('can generate with random', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
    })

    expect(wallet.getAddress()).toBeDefined()
    expect(wallet.getPrivateKey()).toBeDefined()
    expect(wallet.getMnemonic()).toBeDefined()
  })

  it('can getBalance', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
      mnemonic,
    })
    expect(await wallet.getCoinBalance()).toEqual('599.66')
  })

  it('can getTokenBalance', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
      mnemonic,
    })

    expect(
      await wallet.getTokenBalance('KT1WNrZ7pEbpmYBGPib1e7UVCeC6GA6TkJYR'),
    ).toEqual('96')
  })

  it('can estimate sendCoin', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
      mnemonic,
    })

    const estimationResult = await wallet.estimateCostSendCoinTo(
      'tz1PBA9bhbPd5VihHhrZhjHLnXpC4m5zctcv',
      '0.1',
    )
    expect(estimationResult.success).toBe(true)
    // expect(estimationResult.description).toMatch('insufficient funds')
  })

  it('can estimate sendToken', async () => {
    const wallet = new Wallet()
    await wallet.init({
      networkId: 'testnet',
      type: 'tezos',
      rpc: 'https://rpc.ghostnet.teztnets.xyz',
      mnemonic,
    })

    const estimationResult = await wallet.estimateCostSendTokenTo(
      'KT1AfUy48JvqVvtcXKxBDy1guDTJSWd1n8Uv',
      'tz1PBA9bhbPd5VihHhrZhjHLnXpC4m5zctcv',
      '1',
    )
    expect(estimationResult.success).toBe(true)
  })
})

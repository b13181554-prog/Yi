const { TronWeb } = require('tronweb');
const config = require('./config');

const TRON_API_URL = 'https://api.trongrid.io';

const tronWeb = new TronWeb({
  fullHost: TRON_API_URL,
});

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

async function verifyUSDTTransaction(txId, expectedAddress, expectedAmount) {
  try {
    const transaction = await tronWeb.trx.getTransaction(txId);
    
    if (!transaction) {
      return { success: false, error: 'المعاملة غير موجودة' };
    }
    
    const contract = transaction.raw_data.contract[0];
    
    if (contract.type !== 'TriggerSmartContract') {
      return { success: false, error: 'ليست معاملة USDT' };
    }
    
    const contractAddress = tronWeb.address.fromHex(contract.parameter.value.contract_address);
    
    if (contractAddress !== USDT_CONTRACT) {
      return { success: false, error: 'ليست معاملة USDT TRC20' };
    }
    
    const data = contract.parameter.value.data;
    const method = data.substring(0, 8);
    
    if (method !== 'a9059cbb') {
      return { success: false, error: 'طريقة غير صحيحة' };
    }
    
    const toAddress = '41' + data.substring(8, 72);
    const toAddressBase58 = tronWeb.address.fromHex(toAddress);
    
    const amountHex = data.substring(72);
    const amount = parseInt(amountHex, 16) / 1000000;
    
    if (toAddressBase58 !== expectedAddress) {
      return { 
        success: false, 
        error: 'عنوان المستلم غير صحيح',
        details: { received: toAddressBase58, expected: expectedAddress }
      };
    }
    
    if (expectedAmount && Math.abs(amount - expectedAmount) > 0.01) {
      return { 
        success: false, 
        error: 'المبلغ غير مطابق',
        details: { received: amount, expected: expectedAmount }
      };
    }
    
    const transactionInfo = await tronWeb.trx.getTransactionInfo(txId);
    
    if (!transactionInfo || !transactionInfo.receipt) {
      return { 
        success: false, 
        error: 'المعاملة لم تكتمل بعد',
        status: 'pending',
        message: 'يرجى الانتظار حتى يتم تأكيد المعاملة على blockchain'
      };
    }
    
    if (transactionInfo.receipt.result !== 'SUCCESS') {
      return { 
        success: false, 
        error: 'فشلت المعاملة على blockchain',
        status: 'failed',
        message: 'المعاملة تمت معالجتها ولكنها فشلت'
      };
    }
    
    const fromAddress = tronWeb.address.fromHex(transaction.raw_data.contract[0].parameter.value.owner_address);
    
    return {
      success: true,
      data: {
        txId,
        from: fromAddress,
        to: toAddressBase58,
        amount,
        timestamp: transaction.raw_data.timestamp,
        confirmed: true
      }
    };
    
  } catch (error) {
    console.error('Error verifying transaction:', error.message);
    return { success: false, error: 'فشل في التحقق من المعاملة: ' + error.message };
  }
}

async function sendUSDT(toAddress, amount, privateKey) {
  try {
    tronWeb.setPrivateKey(privateKey);
    
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    
    const amountInSun = amount * 1000000;
    
    const result = await contract.transfer(toAddress, amountInSun).send({
      feeLimit: 100000000
    });
    
    return {
      success: true,
      txId: result
    };
    
  } catch (error) {
    console.error('Error sending USDT:', error.message);
    return { success: false, error: 'فشل في إرسال USDT: ' + error.message };
  }
}

async function getUSDTBalance(address) {
  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const balance = await contract.balanceOf(address).call();
    
    return {
      success: true,
      balance: balance / 1000000
    };
    
  } catch (error) {
    console.error('Error getting balance:', error.message);
    return { success: false, error: 'فشل في جلب الرصيد: ' + error.message };
  }
}

module.exports = {
  verifyUSDTTransaction,
  sendUSDT,
  getUSDTBalance
};

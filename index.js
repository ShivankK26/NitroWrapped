const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3200;

const NITRO_API_URL = 'https://api.explorer.routernitro.com/graphql';

const corsOptions = {
  origin: 'http://localhost:3000', // Frontend URL
  methods: ['GET', 'POST'], // Allowed HTTP methods
  credentials: true, // Allow cookies and headers
};

app.use(cors(corsOptions));

async function queryGraphQL(query, variables) {
  try {
    const response = await axios.post(NITRO_API_URL, {
      query,
      variables,
    });
    return response.data.data;
  } catch (error) {
    throw new Error('Failed to fetch data from Nitro API');
  }
}

// Nitro Wrapped summary
app.get('/nitro-wrapped/:walletAddress', async (req, res) => {
  const walletAddress = req.params.walletAddress;

  try {
    const userTransactionsQuery = `
      query GetUsersTransactions($sender_address: String!) {
  getUsersTransactions(sender_address: $sender_address) {
    data {
      src_tx_hash
      dest_tx_hash
      src_chain_id
      dest_chain_id
      src_symbol
      dest_symbol
      fee_amount
      fee_symbol
      gas_fee_usd
      bridge_fee_usd
      sys_fee
      partner_fee
      forwarder_fee
      src_amount
      dest_amount
      src_stable_amount
      dest_stable_amount
      usdc_value
      native_token_amount
      native_token_symbol
      src_timestamp
      dest_timestamp
    }
  }
}
    `;

    const userTransactionsData = await queryGraphQL(userTransactionsQuery, { sender_address: walletAddress });
    const transactions = userTransactionsData?.getUsersTransactions?.data || [];

    if (!transactions.length) {
      return res.json({
        totalTransactions: 0,
        totalGasFeePaid: 0,
        totalUniqueTokensSent: 0,
        totalUniqueTokensReceived: 0,
        totalTokensSent: 0,
        totalTokensReceived: 0,
        topSourceChains: [],
        topDestinationChains: [],
        mostUsedToken: null,
        highestFeeTransaction: null,
        averageTransactionTime: 0,
        maxTransactionTime: 0,
        totalTransactionTime: 0,
      });
    }

    const summary = {
      totalTransactions: transactions.length,
      totalGasFeePaid: 0,
      totalUniqueTokensSent: new Set(),
      totalUniqueTokensReceived: new Set(),
      totalTokensSent: 0,
      totalTokensSentByToken: {},
      totalTokensReceived: 0,
      totalTokensReceivedByToken: {},
      topSourceChains: {},
      topDestinationChains: {},
      tokenUsage: {},
      highestFeeTransaction: { feeAmount: 0, feeToken: "", transactionHash: "" },
      totalTransactionTime: 0,
      maxTransactionTime: 0,
    };

    let transactionCountWithTime = 0;
    let minTransactionTime = Number.MAX_VALUE;

    transactions.forEach(tx => {
      // unique tokens
      summary.totalUniqueTokensSent.add(tx.src_symbol);
      summary.totalUniqueTokensReceived.add(tx.dest_symbol);

      // gas fee
      summary.totalGasFeePaid += parseFloat(tx.gas_fee_usd || 0);

      // source chains
      summary.topSourceChains[tx.src_chain_id] = (summary.topSourceChains[tx.src_chain_id] || 0) + 1;

      // destination chains
      summary.topDestinationChains[tx.dest_chain_id] = (summary.topDestinationChains[tx.dest_chain_id] || 0) + 1

      // track token usage (sent and received)
      if (tx.src_symbol) {
        summary.tokenUsage[tx.src_symbol] = (summary.tokenUsage[tx.src_symbol] || 0) + 1;
      }
      if (tx.dest_symbol) {
        summary.tokenUsage[tx.dest_symbol] = (summary.tokenUsage[tx.dest_symbol] || 0) + 1;
      }

      // calculate value of total amount sent and received
      summary.totalTokensSent += parseFloat(tx.src_amount || 0) + parseFloat(tx.src_stable_amount || 0);
      summary.totalTokensReceived += parseFloat(tx.dest_amount || 0) + parseFloat(tx.dest_stable_amount || 0);

      // aggregate tokens sent amount with name
      if (tx.src_symbol) {
        summary.totalTokensSentByToken[tx.src_symbol] = (summary.totalTokensSentByToken[tx.src_symbol] || 0) +
        parseFloat(tx.src_amount || 0) + parseFloat(tx.src_stable_amount || 0);
      }
      
      // aggregate tokens received amount with name
      if (tx.dest_symbol) {
        summary.totalTokensReceivedByToken[tx.dest_symbol] = (summary.totalTokensReceivedByToken[tx.dest_symbol] || 0) +
          parseFloat(tx.dest_amount || 0) + parseFloat(tx.dest_stable_amount || 0);
      }

      // calculate total fee and highest fee paid transaction
      const gasFee = parseFloat(tx.gas_fee_usd || 0);
      const bridgeFee = parseFloat(tx.bridge_fee_usd || 0);
      const sysFee = parseFloat(tx.sys_fee || 0);
      const partnerFee = parseFloat(tx.partner_fee || 0);
      const forwarderFee = parseFloat(tx.forwarder_fee || 0);
      const totalFee = gasFee + bridgeFee + sysFee + partnerFee + forwarderFee;

      // total fee paid
      summary.totalGasFeePaid = (summary.totalGasFeePaid || 0) + totalFee;

      if (totalFee > summary.highestFeeTransaction.feeAmount) {
        summary.highestFeeTransaction = {
          feeAmount: totalFee,
          feeToken: tx.native_token_symbol || "Unknown",
          transactionHash: tx.src_tx_hash || tx.dest_tx_hash || "Unknown",
        };
      }

      // transaction time calculations
      const srcTimestamp = tx.src_timestamp ? parseFloat(tx.src_timestamp) : 0;
      const destTimestamp = tx.dest_timestamp ? parseFloat(tx.dest_timestamp) : 0;
      const timeSpent = destTimestamp - srcTimestamp;

      if (timeSpent > 0) {
        summary.totalTransactionTime += timeSpent;
        transactionCountWithTime++;
        if (timeSpent > summary.maxTransactionTime) {
          summary.maxTransactionTime = timeSpent;
        }
        if (timeSpent < minTransactionTime) {
          minTransactionTime = timeSpent;
        }
      }

    });

    // convert Sets to counts
    summary.totalUniqueTokensSent = summary.totalUniqueTokensSent.size;
    summary.totalUniqueTokensReceived = summary.totalUniqueTokensReceived.size;

    // sort chains by usage
    summary.topSourceChains = Object.entries(summary.topSourceChains)
      .map(([chain, count]) => ({ chain, count }))
      .sort((a, b) => b.count - a.count);

    summary.topDestinationChains = Object.entries(summary.topDestinationChains)
      .map(([chain, count]) => ({ chain, count }))
      .sort((a, b) => b.count - a.count);


    // top source chain name and count
    const topSourceChain = summary.topSourceChains.length > 0 ? summary.topSourceChains[0] : null;
    if (topSourceChain) {
      summary.topSourceChainCount = { chain: topSourceChain.chain, count: topSourceChain.count };
    } else {
      summary.topSourceChainCount = null;
    }

    // top destination chain name and count
    const topDestinationChain = summary.topDestinationChains.length > 0 ? summary.topDestinationChains[0] : null;
    if (topDestinationChain) {
      summary.topDestinationChainCount = { chain: topDestinationChain.chain, count: topDestinationChain.count };
    } else {
      summary.topDestinationChainCount = null;
    }


    // most used token
    const mostUsedToken = Object.entries(summary.tokenUsage)
      .sort((a, b) => b[1] - a[1])[0];

    summary.mostUsedToken = mostUsedToken ? { name: mostUsedToken[0], count: mostUsedToken[1] } : null;

    // average transaction time
    summary.averageTransactionTime =
      transactionCountWithTime > 0 ? summary.totalTransactionTime / transactionCountWithTime : 0;

    summary.minimumTransactionTime = transactionCountWithTime > 0 ? minTransactionTime : 0;


    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

import React, { useState } from "react";
import axios from "axios";
import { Pie } from "react-chartjs-2";
import "chart.js/auto";

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const BACKEND_API_URL = 'http://localhost:3200/nitro-wrapped';

  const handleSearch = async () => {
    if (!walletAddress) {
      setError("Please enter a wallet address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${BACKEND_API_URL}/${walletAddress}`);
      setData(response.data);
    } catch (err) {
      setError("Failed to fetch data. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
      <h1 className="text-5xl font-extrabold mb-8">Nitro Wrapped</h1>
      <div className="w-full max-w-md">
        <input
          type="text"
          placeholder="Enter Wallet Address"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
        >
          {loading ? "Loading..." : "Search"}
        </button>
      </div>
      {error && <p className="mt-4 text-red-500">{error}</p>}
      {data && (
        <div className="mt-8 bg-gray-800 shadow-lg rounded-lg p-6 w-full max-w-4xl">
          <h2 className="text-3xl font-bold mb-6">Wallet Summary</h2>

          {/* Digital Clock Style Display for Total Tokens Sent */}
          <div className="flex justify-between items-center mb-8">
            <div className="bg-black text-green-400 font-digital text-6xl p-4 rounded-lg shadow-md">
              {data.totalTokensSent ? data.totalTokensSent.toFixed(2) : '0.00'}
            </div>
            <p className="text-lg">Total Tokens Sent</p>
          </div>

          {/* Pie Chart for Token Usage */}
          {data.tokenUsage && (
            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-4">Token Usage</h3>
              <div style={{ width: '300px', height: '300px', margin: '0 auto' }}>
                <Pie
                  data={{
                    labels: Object.keys(data.tokenUsage),
                    datasets: [
                      {
                        data: Object.values(data.tokenUsage),
                        backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
                      },
                    ],
                  }}
                  options={{ maintainAspectRatio: false }}
                />
              </div>
            </div>
          )}

          {/* Progress Bar for Sent and Received Tokens */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4">Tokens Sent vs Received</h3>
            <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden">
              <div
                className="bg-green-500 h-6"
                style={{ width: `${(data.totalTokensReceived / (data.totalTokensReceived + data.totalTokensSent)) * 50 || 0}%` }}
              ></div>
              <div
                className="bg-red-500 h-6"
                style={{ width: `${(data.totalTokensSent / (data.totalTokensReceived + data.totalTokensSent)) * 50 || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Highest Transaction Fee */}
          {data.highestFeeTransaction && (
            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-4">Highest Fee Transaction</h3>
              <p>
                Fee: {data.highestFeeTransaction.feeAmount} {data.highestFeeTransaction.feeToken}
              </p>
              <p>
                <a
                  href={`https://explorer.etherscan.io/tx/${data.highestFeeTransaction.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {data.highestFeeTransaction.transactionHash}
                </a>
              </p>
            </div>
          )}

          {/* Transaction Time Metrics */}
          <div className="mb-8">
            <h3 className="text-2xl font-semibold mb-4">Transaction Times</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <p className="text-lg">Total Time</p>
                <p className="text-2xl font-bold">{data.totalTransactionTime || 0}s</p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <p className="text-lg">Average Time</p>
                <p className="text-2xl font-bold">{data.averageTransactionTime || 0}s</p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <p className="text-lg">Max Time</p>
                <p className="text-2xl font-bold">{data.maxTransactionTime || 0}s</p>
              </div>
              <div className="bg-gray-700 p-4 rounded-lg text-center">
                <p className="text-lg">Min Time</p>
                <p className="text-2xl font-bold">{data.minTransactionTime || 0}s</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
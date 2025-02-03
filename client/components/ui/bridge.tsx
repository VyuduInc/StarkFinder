"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import TokensModal from "./tokens-modal";
import { CryptoCoin } from "@/types/crypto-coin";

interface BridgeProps {
  setSelectedCommand: React.Dispatch<React.SetStateAction<string | null>>;
}

const Bridge: React.FC<BridgeProps> = ({ setSelectedCommand }) => {
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [fromCoin, setFromCoin] = useState<CryptoCoin | null>(null);
  const [toCoin, setToCoin] = useState<CryptoCoin | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectingCoinFor, setSelectingCoinFor] = useState<"from" | "to">("from");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvailableTokens = async () => {
      try {
        const supportedTokens: CryptoCoin[] = [
          {
            name: "ETH",
            symbol: "ETH",
            logo: "https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/6ed5f/eth-diamond-black.webp",
            network: "sepolia",
            chainId: "11155111",
            decimals: 18
          },
          {
            name: "ETH",
            symbol: "ETH",
            logo: "https://pbs.twimg.com/profile_images/1656626805816565763/WyFDMG6u_400x400.png",
            network: "starknet_sepolia",
            chainId: "SN_SEPOLIA",
            decimals: 18
          }
        ];

        if (supportedTokens.length > 0) {
          setFromCoin(supportedTokens[0]);
          setToCoin(supportedTokens[1]);
        }
      } catch (error) {
        console.error('Error setting up available tokens:', error);
        setError('Failed to setup available tokens. Please try again.');
      }
    };

    fetchAvailableTokens();
  }, []);

  const openModal = (type: "from" | "to") => {
    setSelectingCoinFor(type);
    setShowModal(true);
  };

  const handleCoinSelect = (coin: CryptoCoin) => {
    if (selectingCoinFor === "from") {
      if (coin.network === toCoin?.network) {
        setError("Source and destination networks cannot be the same");
        return;
      }
      setFromCoin(coin);
    } else {
      if (coin.network === fromCoin?.network) {
        setError("Source and destination networks cannot be the same");
        return;
      }
      setToCoin(coin);
    }
    setShowModal(false);
    setError(null);
  };

  const handleInputBridge = () => {
    if (fromCoin && toCoin) {
      setFromAmount(toAmount);
      setToAmount(fromAmount);
      setFromCoin(toCoin);
      setToCoin(fromCoin);
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex flex-col items-center justify-center animated fadeIn">
      <div className="bg-white p-6 max-w-lg w-full shadow-lg rounded-xl animated fadeIn">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Bridge</h2>
          <button
            onClick={() => setSelectedCommand(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">From</span>
              <button
                onClick={() => openModal("from")}
                className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
              >
                {fromCoin && (
                  <>
                    <Image
                      src={fromCoin.logo}
                      alt={fromCoin.name}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                    <span>{fromCoin.symbol}</span>
                  </>
                )}
                <ChevronDown size={16} />
              </button>
            </div>
            <input
              type="text"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-transparent text-2xl outline-none"
            />
          </div>

          <button
            onClick={handleInputBridge}
            className="mx-auto block p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowDownUp size={20} />
          </button>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">To</span>
              <button
                onClick={() => openModal("to")}
                className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
              >
                {toCoin && (
                  <>
                    <Image
                      src={toCoin.logo}
                      alt={toCoin.name}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                    <span>{toCoin.symbol}</span>
                  </>
                )}
                <ChevronDown size={16} />
              </button>
            </div>
            <input
              type="text"
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-transparent text-2xl outline-none"
            />
          </div>
        </div>

        {showModal && fromCoin && toCoin && (
          <TokensModal
            blockchain_logo={[fromCoin, toCoin]}
            handleCoinSelect={handleCoinSelect}
            setShowModal={setShowModal}
          />
        )}

        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
};

export default Bridge;

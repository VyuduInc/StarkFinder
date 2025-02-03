import React from "react";
import Image from "next/image";
import { X } from "react-feather";
import { CryptoCoin } from "@/types/crypto-coin";

type TokensModalProps = {
  blockchain_logo: CryptoCoin[];
  handleCoinSelect: (coin: CryptoCoin) => void;
  setShowModal: (show: boolean) => void;
};

const TokensModal: React.FC<TokensModalProps> = ({
  blockchain_logo,
  handleCoinSelect,
  setShowModal,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="relative bg-white rounded-lg w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Select Token</h2>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-4">
          {blockchain_logo.map((coin, index) => (
            <div
              key={`${coin.symbol}-${coin.network}-${index}`}
              onClick={() => handleCoinSelect(coin)}
              className="flex items-center p-3 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              <div className="w-8 h-8 mr-3">
                <Image
                  src={coin.logo}
                  alt={coin.name}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              </div>
              <div>
                <div className="font-medium">{coin.symbol}</div>
                <div className="text-sm text-gray-500">
                  {coin.network === "sepolia" ? "Ethereum Sepolia" : "StarkNet Sepolia"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TokensModal;
